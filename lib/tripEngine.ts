// ---------------------------------------------------------------------------
// Trip Engine — a backend-style simulation layer for the rideshare dashboard.
//
// This module is framework-agnostic (no React imports). It owns:
//   • Driver fleet generation
//   • Nearest-driver assignment
//   • State machine:  idle → searching → assigned → arriving → arrived → on_trip → completed
//   • Interval-driven driver movement with ETA
//   • Snapshot emission via a listener callback
//
// UI components subscribe to snapshots and render — they never mutate trip
// state directly.  This mirrors how a real backend would push updates over
// a WebSocket or polling channel.
// ---------------------------------------------------------------------------

// ---- Geo helpers ----------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ---- Driver fleet ---------------------------------------------------------

export interface Driver {
  id: string;
  position: LatLng;
}

const DRIVER_COUNT = 8;
const SPREAD_DEG = 0.015; // ~1.5 km radius

function seededRng(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash & 0x7fffffff) / 2147483647;
  };
}

export function generateFleet(center: LatLng): Driver[] {
  const seed = `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
  const rand = seededRng(seed);
  return Array.from({ length: DRIVER_COUNT }, (_, i) => ({
    id: `driver-${i}`,
    position: {
      lat: center.lat + (rand() - 0.5) * 2 * SPREAD_DEG,
      lng: center.lng + (rand() - 0.5) * 2 * SPREAD_DEG,
    },
  }));
}

function findNearest(fleet: Driver[], target: LatLng): Driver {
  let best = fleet[0];
  let bestDist = haversineKm(target, best.position);
  for (let i = 1; i < fleet.length; i++) {
    const d = haversineKm(target, fleet[i].position);
    if (d < bestDist) {
      best = fleet[i];
      bestDist = d;
    }
  }
  return best;
}

// ---- Trip types -----------------------------------------------------------

export type TripPhase =
  | 'idle'
  | 'searching'
  | 'assigned'
  | 'arriving'
  | 'arrived'
  | 'on_trip'
  | 'completed';

export interface Trip {
  id: string;
  pickup: LatLng;
  dropoff: LatLng | null;
  driverId: string;
  status: TripPhase;
  eta: number;           // minutes remaining
  remainingKm: number;
}

/** The full picture that the UI subscribes to. */
export interface TripSnapshot {
  trip: Trip | null;
  fleet: Driver[];
  assignedDriverPosition: LatLng | null;
}

export type TripListener = (snapshot: TripSnapshot) => void;

// ---- Engine ---------------------------------------------------------------

const TICK_MS = 1000;
const STEP_FRACTION = 0.06;
const ARRIVAL_KM = 0.02;         // 20 m
const ARRIVED_PAUSE_MS = 2000;
const AVG_SPEED_KMH = 30;

function etaFromDist(km: number): number {
  return Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60));
}

let tripCounter = 0;

export class TripEngine {
  private trip: Trip | null = null;
  private fleet: Driver[] = [];
  private driverPos: LatLng | null = null;
  private phase: TripPhase = 'idle';

  private interval: ReturnType<typeof setInterval> | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private listener: TripListener | null = null;

  // -- public API -----------------------------------------------------------

  /** Register the single listener (React hook calls this). */
  subscribe(fn: TripListener): () => void {
    this.listener = fn;
    this.emit();
    return () => {
      if (this.listener === fn) this.listener = null;
    };
  }

  /** Call when pickup changes. Generates fleet + assigns nearest driver. */
  setPickup(pickup: LatLng | null): void {
    this.stop();

    if (!pickup) {
      this.trip = null;
      this.fleet = [];
      this.driverPos = null;
      this.phase = 'idle';
      this.emit();
      return;
    }

    this.fleet = generateFleet(pickup);
    const nearest = findNearest(this.fleet, pickup);
    const dist = haversineKm(nearest.position, pickup);

    this.trip = {
      id: `trip-${++tripCounter}`,
      pickup,
      dropoff: this.trip?.dropoff ?? null,
      driverId: nearest.id,
      status: 'arriving',
      eta: etaFromDist(dist),
      remainingKm: dist,
    };

    this.driverPos = { ...nearest.position };
    this.phase = 'arriving';
    this.emit();
    this.startSimulation();
  }

  /** Call when dropoff changes (may be null). */
  setDropoff(dropoff: LatLng | null): void {
    if (this.trip) {
      this.trip = { ...this.trip, dropoff };
    }
    // No need to restart — the simulation reads dropoff from this.trip.
  }

  /** Get the current snapshot synchronously. */
  getSnapshot(): TripSnapshot {
    return {
      trip: this.trip ? { ...this.trip } : null,
      fleet: this.fleet,
      assignedDriverPosition: this.driverPos ? { ...this.driverPos } : null,
    };
  }

  /** Full teardown — call on unmount. */
  destroy(): void {
    this.stop();
    this.listener = null;
  }

  // -- internals ------------------------------------------------------------

  private emit(): void {
    this.listener?.(this.getSnapshot());
  }

  private stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  private updateTrip(partial: Partial<Trip>): void {
    if (!this.trip) return;
    this.trip = { ...this.trip, ...partial };
  }

  private startSimulation(): void {
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    if (!this.trip || !this.driverPos) return;

    if (this.phase === 'arriving') {
      this.moveToward(this.trip.pickup, () => {
        this.phase = 'arrived';
        this.updateTrip({ status: 'arrived', eta: 0, remainingKm: 0 });
        this.emit();

        this.pauseTimer = setTimeout(() => {
          if (this.trip?.dropoff) {
            const dist = haversineKm(this.trip.pickup, this.trip.dropoff);
            this.phase = 'on_trip';
            this.updateTrip({
              status: 'on_trip',
              eta: etaFromDist(dist),
              remainingKm: dist,
            });
            this.emit();
          }
        }, ARRIVED_PAUSE_MS);
      });
      return;
    }

    if (this.phase === 'on_trip' && this.trip.dropoff) {
      this.moveToward(this.trip.dropoff, () => {
        this.phase = 'completed';
        this.updateTrip({ status: 'completed', eta: 0, remainingKm: 0 });
        this.stop();
        this.emit();
      });
      return;
    }
  }

  private moveToward(target: LatLng, onArrive: () => void): void {
    if (!this.driverPos) return;

    const remaining = haversineKm(this.driverPos, target);
    if (remaining < ARRIVAL_KM) {
      this.driverPos = { ...target };
      onArrive();
      return;
    }

    this.driverPos = {
      lat: this.driverPos.lat + (target.lat - this.driverPos.lat) * STEP_FRACTION,
      lng: this.driverPos.lng + (target.lng - this.driverPos.lng) * STEP_FRACTION,
    };

    const newRemaining = haversineKm(this.driverPos, target);
    this.updateTrip({
      eta: etaFromDist(newRemaining),
      remainingKm: newRemaining,
    });
    this.emit();
  }
}
