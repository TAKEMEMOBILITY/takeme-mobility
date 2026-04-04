'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { useActiveRide, type RidePhase } from '@/lib/useActiveRide';

// ── Phase config ─────────────────────────────────────────────────────────

const PHASES: Record<RidePhase, {
  label: string;
  sub: string;
  color: string;
  pulse: boolean;
}> = {
  searching_driver: {
    label: 'Finding your driver',
    sub: 'This usually takes a moment',
    color: 'bg-[#86868B]',
    pulse: true,
  },
  driver_assigned: {
    label: 'Driver assigned',
    sub: 'Your driver is preparing',
    color: 'bg-[#0071E3]',
    pulse: false,
  },
  driver_arriving: {
    label: 'Driver on the way',
    sub: 'Heading to your pickup',
    color: 'bg-[#0071E3]',
    pulse: true,
  },
  arrived: {
    label: 'Driver has arrived',
    sub: 'Head to the pickup point',
    color: 'bg-[#0071e3]',
    pulse: false,
  },
  in_progress: {
    label: 'Trip in progress',
    sub: 'Enjoy your ride',
    color: 'bg-[#0071E3]',
    pulse: true,
  },
  completed: {
    label: 'You\'ve arrived',
    sub: 'Thanks for riding with TakeMe',
    color: 'bg-[#0071e3]',
    pulse: false,
  },
  cancelled: {
    label: 'Ride cancelled',
    sub: 'This ride has been cancelled',
    color: 'bg-[#86868B]',
    pulse: false,
  },
};

// ── Map styles ───────────────────────────────────────────────────────────

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#6E6E73' }] },
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

function pinSvg(fill: string): string {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="10" fill="${fill}" opacity="0.15"/>
      <circle cx="14" cy="14" r="6" fill="${fill}"/>
      <circle cx="14" cy="14" r="2.5" fill="white"/>
    </svg>
  `);
}

function driverSvg(): string {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#1D1D1F"/>
      <circle cx="16" cy="16" r="12" fill="#1D1D1F"/>
      <path d="M16 8 L22 20 L16 17 L10 20 Z" fill="white" opacity="0.9"/>
    </svg>
  `);
}

// ── Component ────────────────────────────────────────────────────────────

interface RideTrackerProps {
  rideId: string;
  onClose?: () => void;
}

const RIDER_CANCELLABLE: RidePhase[] = [
  'searching_driver',
  'driver_assigned',
  'driver_arriving',
  'arrived',
];

export default function RideTracker({ rideId, onClose }: RideTrackerProps) {
  const { isLoaded } = useGoogleMaps();
  const { ride, driver, driverPosition, loading } = useActiveRide(rideId);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = useCallback(async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await fetch('/api/rides/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId }),
      });
      // Realtime will deliver the cancelled status update
    } catch {
      // Ride status will reflect the actual state via Realtime
    } finally {
      setCancelling(false);
    }
  }, [rideId, cancelling]);

  // Fit bounds when ride loads or driver moves
  useEffect(() => {
    if (!mapRef.current || !ride) return;
    if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return;
    try {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: ride.pickupLat, lng: ride.pickupLng });
      bounds.extend({ lat: ride.dropoffLat, lng: ride.dropoffLng });
      if (driverPosition) {
        bounds.extend({ lat: driverPosition.lat, lng: driverPosition.lng });
      }
      mapRef.current.fitBounds(bounds, { top: 60, bottom: 60, left: 40, right: 40 });
    } catch {}
  }, [ride, driverPosition]);

  if (loading) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-2xl bg-[#F5F5F7]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E8E8ED] border-t-[#1D1D1F]" />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-2xl bg-[#F5F5F7]">
        <p className="text-[15px] text-[#86868B]">Ride not found</p>
      </div>
    );
  }

  const phase = PHASES[ride.status] ?? PHASES.searching_driver;
  const isTerminal = ride.status === 'completed' || ride.status === 'cancelled';

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">

      {/* ── Map ──────────────────────────────────────────────── */}
      <div className="relative h-[320px] bg-[#F2F2F7]">
        {isLoaded && typeof google !== 'undefined' && google.maps?.Map && (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: ride.pickupLat, lng: ride.pickupLng }}
            zoom={13}
            onLoad={(map: google.maps.Map) => { mapRef.current = map; }}
            options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: true, clickableIcons: false }}
          >
            <Marker
              position={{ lat: ride.pickupLat, lng: ride.pickupLng }}
              icon={google.maps.Size ? { url: pinSvg('#0071e3'), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) } : undefined}
            />
            <Marker
              position={{ lat: ride.dropoffLat, lng: ride.dropoffLng }}
              icon={google.maps.Size ? { url: pinSvg('#1D1D1F'), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) } : undefined}
            />
            {driverPosition && !isTerminal && (
              <Marker
                position={{ lat: driverPosition.lat, lng: driverPosition.lng }}
                icon={google.maps.Size ? { url: driverSvg(), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16), rotation: driverPosition.heading ?? 0 } : undefined}
                zIndex={100}
              />
            )}
          </GoogleMap>
        )}

        {/* Phase badge */}
        <div className="absolute left-4 top-4 flex items-center gap-2.5 rounded-full bg-white/90 px-4 py-2 shadow-[0_1px_6px_rgba(0,0,0,0.06)] backdrop-blur-sm">
          <span className="relative flex h-2.5 w-2.5">
            {phase.pulse && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${phase.color} opacity-30`} />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${phase.color}`} />
          </span>
          <span className="text-[13px] font-semibold text-[#1D1D1F]">{phase.label}</span>
        </div>
      </div>

      {/* ── Info panel ─────────────────────────────────────── */}
      <div className="p-5">

        {/* Status */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <span className={`h-3.5 w-3.5 rounded-full ${phase.color}`} />
            {phase.pulse && (
              <span className={`absolute inset-0 rounded-full ${phase.color} animate-ping opacity-15`} />
            )}
          </div>
          <div>
            <p className="text-[17px] font-semibold text-[#1D1D1F]">{phase.label}</p>
            <p className="text-[14px] text-[#86868B]">{phase.sub}</p>
          </div>
        </div>

        {/* Driver card */}
        {driver && ride.assignedDriverId && (
          <div className="mt-4 flex items-center gap-4 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1D1D1F] text-[14px] font-bold text-white">
              {driver.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#1D1D1F]">{driver.name}</p>
              <p className="text-[13px] text-[#86868B]">
                {driver.vehicleMake} {driver.vehicleModel}
                {driver.vehicleColor ? ` · ${driver.vehicleColor}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[14px] font-semibold text-[#1D1D1F]">{driver.plateNumber}</p>
              <p className="text-[12px] text-[#86868B]">★ {driver.rating.toFixed(1)}</p>
            </div>
          </div>
        )}

        {/* Route summary */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#0071e3]" />
            <span className="truncate text-[14px] text-[#1D1D1F]">{ride.pickupAddress}</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#1D1D1F]" />
            <span className="truncate text-[14px] text-[#1D1D1F]">{ride.dropoffAddress}</span>
          </div>
        </div>

        {/* Fare bar */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F5F5F7] px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="text-[14px] tabular-nums text-[#86868B]">{ride.distanceKm} km</span>
            <span className="text-[14px] tabular-nums text-[#86868B]">{ride.durationMin} min</span>
          </div>
          <span className="text-[18px] font-bold tabular-nums text-[#1D1D1F]">
            ${(ride.finalFare ?? ride.estimatedFare).toFixed(2)}
          </span>
        </div>

        {/* Cancel button — only for cancellable phases */}
        {!isTerminal && RIDER_CANCELLABLE.includes(ride.status) && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-[#E8E8ED] py-3 text-[14px] font-medium text-[#86868B] transition-colors duration-200 hover:bg-[#F5F5F7] disabled:opacity-40"
          >
            {cancelling ? 'Cancelling...' : 'Cancel ride'}
          </button>
        )}

        {/* Close / done button */}
        {isTerminal && onClose && (
          <button
            onClick={onClose}
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#1D1D1F] py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]"
          >
            {ride.status === 'completed' ? 'Done' : 'Close'}
          </button>
        )}
      </div>
    </div>
  );
}
