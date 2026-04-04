'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useGoogleMaps, type MapLoadStatus } from './GoogleMapsProvider';
import type { TripSnapshot, TripPhase } from '@/lib/tripEngine';

const defaultCenter = { lat: 47.6062, lng: -122.3321 };
const containerStyle = { width: '100%', height: '100%' };

// ── Custom map style ──────────────────────────────────────────────────────
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#6B6B76' }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 3 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D6E4F0' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F0F0F3' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#E5E5EA' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#FAFAFA' }] },
  { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#E8F0E4' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
];

const ROUTE_OPTIONS: google.maps.DirectionsRendererOptions = {
  suppressMarkers: true,
  polylineOptions: { strokeColor: '#0C0C0E', strokeWeight: 4, strokeOpacity: 0.7 },
};

const PHASE_LABELS: Record<string, { label: string; pulse: boolean }> = {
  arriving:  { label: 'Driver approaching', pulse: true },
  arrived:   { label: 'Driver has arrived', pulse: false },
  on_trip:   { label: 'Trip in progress',   pulse: true },
  completed: { label: 'Trip complete',      pulse: false },
};

// ── Bearing calculation ───────────────────────────────────────────────────
function bearingDeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
            Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ── Vehicle SVG builders ──────────────────────────────────────────────────

function vehicleSvg(opts: {
  headlightIntensity: number;
  shadowOpacity: number;
}): string {
  const hl = opts.headlightIntensity;
  const sh = opts.shadowOpacity;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
<svg viewBox="0 0 48 88" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="paint" x1="24" y1="8" x2="24" y2="72" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#252528"/>
      <stop offset="35%" stop-color="#151517"/>
      <stop offset="100%" stop-color="#101012"/>
    </linearGradient>
    <linearGradient id="sideL" x1="10" y1="0" x2="16" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3A3A3E" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#151517" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sideR" x1="38" y1="0" x2="32" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3A3A3E" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#151517" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="glass" x1="24" y1="20" x2="24" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4A4A52"/>
      <stop offset="40%" stop-color="#28282C"/>
      <stop offset="100%" stop-color="#1E1E22"/>
    </linearGradient>
    <radialGradient id="beamL" cx="16" cy="2" r="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="${0.7 * hl}"/>
      <stop offset="40%" stop-color="#E8F0FF" stop-opacity="${0.25 * hl}"/>
      <stop offset="100%" stop-color="#E8F0FF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="beamR" cx="32" cy="2" r="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="${0.7 * hl}"/>
      <stop offset="40%" stop-color="#E8F0FF" stop-opacity="${0.25 * hl}"/>
      <stop offset="100%" stop-color="#E8F0FF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sh1" cx="24" cy="50" r="26" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#000" stop-opacity="${0.18 * sh}"/>
      <stop offset="70%" stop-color="#000" stop-opacity="${0.06 * sh}"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sh2" cx="24" cy="46" r="18" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#000" stop-opacity="${0.12 * sh}"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <ellipse cx="24" cy="50" rx="22" ry="34" fill="url(#sh1)"/>
  <ellipse cx="24" cy="46" rx="16" ry="24" fill="url(#sh2)"/>

  ${hl > 0.05 ? `
    <ellipse cx="16" cy="0" rx="8" ry="12" fill="url(#beamL)"/>
    <ellipse cx="32" cy="0" rx="8" ry="12" fill="url(#beamR)"/>
  ` : ''}

  <path d="
    M 16 14
    C 16 10, 20 7, 24 7
    C 28 7, 32 10, 32 14
    L 33 20
    L 34 30
    L 34 56
    C 34 60, 33 63, 32 64
    C 30 67, 28 68, 24 68
    C 20 68, 18 67, 16 64
    C 15 63, 14 60, 14 56
    L 14 30
    L 15 20
    Z
  " fill="url(#paint)"/>

  <path d="M 14 22 L 14 56 C 14 60, 15 63, 16 64 L 16 20 Z" fill="url(#sideL)"/>
  <path d="M 34 22 L 34 56 C 34 60, 33 63, 32 64 L 32 20 Z" fill="url(#sideR)"/>

  <line x1="18" y1="15" x2="30" y2="15" stroke="#2A2A2E" stroke-width="0.5" opacity="0.5"/>
  <line x1="18" y1="60" x2="30" y2="60" stroke="#1A1A1C" stroke-width="0.5" opacity="0.5"/>

  <path d="
    M 18 24
    C 18 21, 21 19, 24 19
    C 27 19, 30 21, 30 24
    L 30 46
    C 30 49, 27 51, 24 51
    C 21 51, 18 49, 18 46
    Z
  " fill="#0E0E10"/>

  <path d="
    M 18.5 19.5
    C 18.5 17, 21 15.5, 24 15.5
    C 27 15.5, 29.5 17, 29.5 19.5
    L 29.5 26
    C 29.5 27, 27 28, 24 28
    C 21 28, 18.5 27, 18.5 26
    Z
  " fill="url(#glass)" opacity="0.85"/>

  <path d="
    M 20 17 C 20 16.5, 22 16, 24 16 C 26 16, 28 16.5, 28 17
    L 27 18 C 26 17.5, 25 17.3, 24 17.3 C 23 17.3, 22 17.5, 21 18 Z
  " fill="white" opacity="0.08"/>

  <path d="
    M 19.5 48
    C 19.5 47, 21.5 46, 24 46
    C 26.5 46, 28.5 47, 28.5 48
    L 28.5 52
    C 28.5 53, 26.5 54, 24 54
    C 21.5 54, 19.5 53, 19.5 52
    Z
  " fill="#1C1C20" opacity="0.7"/>

  <rect x="16" y="13" width="5" height="1.2" rx="0.6" fill="white" opacity="${0.55 + 0.45 * hl}"/>
  <rect x="27" y="13" width="5" height="1.2" rx="0.6" fill="white" opacity="${0.55 + 0.45 * hl}"/>

  ${hl > 0.2 ? `
    <rect x="17" y="13.1" width="3" height="1" rx="0.5" fill="white" opacity="${0.3 * hl}">
      <animate attributeName="opacity" values="${0.25 * hl};${0.35 * hl};${0.25 * hl}" dur="3s" repeatCount="indefinite"/>
    </rect>
    <rect x="28" y="13.1" width="3" height="1" rx="0.5" fill="white" opacity="${0.3 * hl}">
      <animate attributeName="opacity" values="${0.25 * hl};${0.35 * hl};${0.25 * hl}" dur="3s" repeatCount="indefinite"/>
    </rect>
  ` : ''}

  <rect x="16" y="63.5" width="16" height="1.2" rx="0.6" fill="#FF453A" opacity="0.5"/>
  <rect x="18" y="63.7" width="12" height="0.8" rx="0.4" fill="#FF6B6B" opacity="0.25"/>

  <ellipse cx="12.5" cy="24" rx="2" ry="1.2" fill="#1A1A1C"/>
  <ellipse cx="35.5" cy="24" rx="2" ry="1.2" fill="#1A1A1C"/>

  <path d="M 13.5 18 C 12 18, 12 22, 13.5 22" fill="#0A0A0C" opacity="0.5"/>
  <path d="M 34.5 18 C 36 18, 36 22, 34.5 22" fill="#0A0A0C" opacity="0.5"/>

  <path d="M 13.5 54 C 12 54, 12 58, 13.5 58" fill="#0A0A0C" opacity="0.5"/>
  <path d="M 34.5 54 C 36 54, 36 58, 34.5 58" fill="#0A0A0C" opacity="0.5"/>

  <circle cx="13" cy="20" r="1.8" fill="#0C0C0E" opacity="0.7"/>
  <circle cx="35" cy="20" r="1.8" fill="#0C0C0E" opacity="0.7"/>
  <circle cx="13" cy="56" r="1.8" fill="#0C0C0E" opacity="0.7"/>
  <circle cx="35" cy="56" r="1.8" fill="#0C0C0E" opacity="0.7"/>

  <line x1="24" y1="16" x2="24" y2="62" stroke="#1E1E22" stroke-width="0.3" opacity="0.3"/>
</svg>`);
}

function fleetVehicleSvg(): string {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
<svg viewBox="0 0 48 88" xmlns="http://www.w3.org/2000/svg" opacity="0.3">
  <defs>
    <linearGradient id="fp" x1="24" y1="8" x2="24" y2="68" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#B0B0B8"/>
      <stop offset="100%" stop-color="#9B9BA7"/>
    </linearGradient>
  </defs>
  <ellipse cx="24" cy="48" rx="14" ry="22" fill="#000" opacity="0.04"/>
  <path d="
    M 16 14 C 16 10, 20 7, 24 7 C 28 7, 32 10, 32 14
    L 33 20 L 34 56 C 34 60, 33 63, 32 64
    C 30 67, 28 68, 24 68 C 20 68, 18 67, 16 64
    C 15 63, 14 60, 14 56 L 14 30 L 15 20 Z
  " fill="url(#fp)"/>
  <path d="
    M 18 24 C 18 21, 21 19, 24 19 C 27 19, 30 21, 30 24
    L 30 46 C 30 49, 27 51, 24 51 C 21 51, 18 49, 18 46 Z
  " fill="#8A8A96"/>
</svg>`);
}

function pinSvg(fill: string): string {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="10" fill="${fill}" opacity="0.15"/>
      <circle cx="14" cy="14" r="6" fill="${fill}"/>
      <circle cx="14" cy="14" r="3" fill="white"/>
    </svg>
  `);
}

function userSvg(): string {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="12" fill="#0A84FF" opacity="0.12"/>
      <circle cx="14" cy="14" r="6" fill="#0A84FF"/>
      <circle cx="14" cy="14" r="2.5" fill="white"/>
    </svg>
  `);
}

// ═══════════════════════════════════════════════════════════════════════════
// UX State Components — Premium, calm, zero technical language
// ═══════════════════════════════════════════════════════════════════════════

function MapLoadingState({ status, attempt, maxAttempts }: {
  status: MapLoadStatus;
  attempt: number;
  maxAttempts: number;
}) {
  const isRetrying = status === 'retrying';

  return (
    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-surface-secondary">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        {/* Animated map placeholder — subtle grid pattern */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-xl bg-surface-tertiary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-[2px] border-border border-t-ink" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-[14px] font-semibold text-ink">
            {isRetrying ? 'Reconnecting' : 'Preparing your map'}
          </p>
          <p className="mt-1 text-[12px] text-ink-tertiary">
            {isRetrying
              ? `Attempt ${attempt} of ${maxAttempts}`
              : 'This takes just a moment'
            }
          </p>
        </div>

        {/* Subtle progress indication for retries */}
        {isRetrying && (
          <div className="flex gap-1.5">
            {Array.from({ length: maxAttempts }).map((_, i) => (
              <div
                key={i}
                className={`h-1 w-6 rounded-full transition-colors duration-500 ${
                  i < attempt ? 'bg-ink-tertiary' : 'bg-border'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MapDegradedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-surface-secondary">
      <div className="flex max-w-xs flex-col items-center gap-5 px-6 text-center animate-fade-in">
        {/* Calm icon — not an error symbol */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-tertiary">
          <svg className="h-6 w-6 text-ink-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
          </svg>
        </div>

        <div>
          <p className="text-[15px] font-semibold text-ink">
            Map temporarily unavailable
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
            You can still book rides by entering your pickup and destination below. We'll keep trying in the background.
          </p>
        </div>

        <button
          onClick={onRetry}
          className="rounded-xl bg-surface-tertiary px-5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-border active:scale-[0.98]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

interface MapProps {
  pickupLocation?: { lat: number; lng: number };
  dropoffLocation?: { lat: number; lng: number };
  currentLocation?: { lat: number; lng: number };
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  onRouteError?: (message: string) => void;
  tripSnapshot: TripSnapshot;
}

export default function Map({
  pickupLocation,
  dropoffLocation,
  currentLocation,
  onLocationSelect,
  onRouteError,
  tripSnapshot,
}: MapProps) {
  const { isLoaded, status, retry, attempt, maxAttempts } = useGoogleMaps();

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeError, setRouteError] = useState('');
  const mapRef = useRef<google.maps.Map | null>(null);
  const onRouteErrorRef = useRef(onRouteError);
  onRouteErrorRef.current = onRouteError;

  const prevDriverPos = useRef<{ lat: number; lng: number } | null>(null);
  const driverBearing = useRef<number>(0);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const onMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (onLocationSelect && event.latLng) {
        onLocationSelect({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      }
    },
    [onLocationSelect],
  );

  // ── Directions ──────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof google === 'undefined' || !google.maps) return;

    if (!pickupLocation || !dropoffLocation) {
      setDirections(null);
      setRouteError('');
      onRouteErrorRef.current?.('');
      return;
    }

    let cancelled = false;
    new google.maps.DirectionsService().route(
      {
        origin: new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng),
        destination: new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (cancelled) return;
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          setRouteError('');
          onRouteErrorRef.current?.('');
          const bounds = result.routes?.[0]?.bounds;
          if (mapRef.current && bounds) {
            mapRef.current.fitBounds(bounds, { bottom: 260, top: 20, left: 20, right: 20 });
          }
        } else {
          setDirections(null);
          // User-safe message — no status codes
          const msg = 'Route not available for these locations. Try a different destination.';
          setRouteError(msg);
          onRouteErrorRef.current?.(msg);
        }
      },
    );
    return () => { cancelled = true; };
  }, [pickupLocation, dropoffLocation]);

  useEffect(() => {
    if (!mapRef.current || directions) return;
    if (typeof google === 'undefined' || !google.maps) return;

    const bounds = new google.maps.LatLngBounds();
    if (currentLocation) bounds.extend(currentLocation);
    if (pickupLocation) bounds.extend(pickupLocation);
    if (dropoffLocation) bounds.extend(dropoffLocation);

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { bottom: 260, top: 20, left: 20, right: 20 });
    }
  }, [currentLocation, pickupLocation, dropoffLocation, directions]);

  // ── Derived ─────────────────────────────────────────────────────────

  const { trip, fleet, assignedDriverPosition } = tripSnapshot;
  const phase: TripPhase = trip?.status ?? 'idle';
  const isActive = phase !== 'idle';
  const activeDirections = pickupLocation && dropoffLocation ? directions : null;

  // Stable initial center — only set once, never changes to avoid map re-renders
  const initialPositionRef = useRef(currentLocation || pickupLocation || defaultCenter);
  const initialPosition = initialPositionRef.current;

  // ── Compute bearing for assigned driver rotation ────────────────────
  if (assignedDriverPosition) {
    const prev = prevDriverPos.current;
    if (prev) {
      const dlat = assignedDriverPosition.lat - prev.lat;
      const dlng = assignedDriverPosition.lng - prev.lng;
      if (Math.abs(dlat) > 0.000001 || Math.abs(dlng) > 0.000001) {
        driverBearing.current = bearingDeg(prev, assignedDriverPosition);
      }
    }
    prevDriverPos.current = { ...assignedDriverPosition };
  } else {
    prevDriverPos.current = null;
  }

  // ── Vehicle state for SVG ───────────────────────────────────────────
  const headlightIntensity = phase === 'arriving' ? 0.8 : phase === 'on_trip' ? 0.5 : phase === 'arrived' ? 0.3 : 0;
  const shadowOpacity = isActive ? 1 : 0.6;

  // ── Render guards — Premium UX states ───────────────────────────────

  if (status === 'degraded') {
    return <MapDegradedState onRetry={retry} />;
  }

  if (!isLoaded) {
    return <MapLoadingState status={status} attempt={attempt} maxAttempts={maxAttempts} />;
  }

  // ── JSX ─────────────────────────────────────────────────────────────

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={initialPosition}
      zoom={12}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={onMapClick}
      options={{
        styles: MAP_STYLES,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: typeof google !== 'undefined' ? google.maps.ControlPosition.RIGHT_CENTER : undefined },
        clickableIcons: false,
      }}
    >
      {/* User location */}
      {currentLocation && (
        <Marker
          position={currentLocation}
          icon={{ url: userSvg(), scaledSize: new google.maps.Size(28, 28), anchor: new google.maps.Point(14, 14) }}
          zIndex={5}
        />
      )}

      {/* Pickup pin */}
      {pickupLocation && (
        <Marker
          position={pickupLocation}
          icon={{ url: pinSvg('#30D158'), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) }}
          zIndex={20}
        />
      )}

      {/* Dropoff pin */}
      {dropoffLocation && (
        <Marker
          position={dropoffLocation}
          icon={{ url: pinSvg('#FF453A'), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) }}
          zIndex={20}
        />
      )}

      {/* Fleet vehicles */}
      {fleet
        .filter((d) => d.id !== trip?.driverId)
        .map((driver) => (
          <Marker
            key={driver.id}
            position={driver.position}
            icon={{
              url: fleetVehicleSvg(),
              scaledSize: new google.maps.Size(16, 29),
              anchor: new google.maps.Point(8, 14),
            }}
            zIndex={8}
          />
        ))}

      {/* Assigned vehicle */}
      {assignedDriverPosition && trip && isActive && (
        <Marker
          key={trip.driverId}
          position={assignedDriverPosition}
          icon={{
            url: vehicleSvg({ headlightIntensity, shadowOpacity }),
            scaledSize: new google.maps.Size(26, 48),
            anchor: new google.maps.Point(13, 24),
            rotation: driverBearing.current,
          }}
          zIndex={100}
          title={PHASE_LABELS[phase]?.label ?? 'Your vehicle'}
        />
      )}

      {/* Route */}
      {activeDirections && (
        <DirectionsRenderer directions={activeDirections} options={ROUTE_OPTIONS} />
      )}

      {/* Phase label */}
      {isActive && (() => {
        const s = PHASE_LABELS[phase] ?? PHASE_LABELS.arriving;
        return (
          <div className="absolute left-4 top-4 z-50 flex items-center gap-2.5 rounded-full border border-white/30 bg-white/80 px-4 py-2 shadow-lg backdrop-blur-xl animate-fade-in">
            <span className={`h-2 w-2 rounded-full ${
              phase === 'on_trip' || phase === 'arriving' ? 'bg-accent' : 'bg-success'
            } ${s.pulse ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-semibold text-ink">{s.label}</span>
          </div>
        );
      })()}

      {/* Route error — user-safe language */}
      {routeError && (
        <div className={`absolute ${isActive ? 'left-4 top-14' : 'left-4 top-4'} z-50 rounded-full border border-white/30 bg-white/80 px-4 py-2 shadow-lg backdrop-blur-xl`}>
          <span className="text-xs font-medium text-ink-secondary">{routeError}</span>
        </div>
      )}
    </GoogleMap>
  );
}
