'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useGoogleMapsLoader } from '@/lib/useGoogleMapsLoader';
import { useDirections } from '@/lib/useDirections';
import { SEATTLE_TIERS, calculateAllFares, kmToMiles, type VehicleClass, type FareResult } from '@/lib/seattle-pricing';

interface LatLng { lat: number; lng: number }
interface LocationState extends LatLng { address: string }

const SEATTLE_CENTER = { lat: 47.6062, lng: -122.3321 };

const MAP_STYLES = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#6E6E73' }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 3 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C8DDF0' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#EEEEF2' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#D2D2D7' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#F5F5F7' }] },
  { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#DDE8D6' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
];

export default function HeroBookingWrapper({ ctaHref }: { ctaHref: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { ready: mapsReady, failed: mapsFailed } = useGoogleMapsLoader();

  const [pickup, setPickup] = useState<LocationState | null>(null);
  const [dropoff, setDropoff] = useState<LocationState | null>(null);
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [selectedTier, setSelectedTier] = useState<VehicleClass>('comfort');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const pickupAcRef = useRef<google.maps.places.Autocomplete | null>(null);
  const dropoffAcRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { route, directionsResult, loading: routeLoading, error: routeError } = useDirections(pickup, dropoff, mapsReady);
  const fares: FareResult[] = route ? calculateAllFares(route.distanceKm, route.durationMin) : [];
  const selectedFare = fares.find(f => f.vehicleClass === selectedTier);
  const distanceMiles = route ? kmToMiles(route.distanceKm) : null;
  const hasRoute = !!(pickup && dropoff && route && fares.length > 0);

  // ── Map init ───────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current) return;
    if (typeof google === 'undefined' || !google.maps?.Map) return;
    if (mapRef.current) return; // already initialized

    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      center: SEATTLE_CENTER,
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: false,
      styles: MAP_STYLES,
      clickableIcons: false,
    });

    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#1D1D1F',
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    });
    directionsRendererRef.current.setMap(mapRef.current);
  }, [mapsReady]);

  // ── Update route on map ────────────────────────────────────────────
  useEffect(() => {
    if (!directionsRendererRef.current || !mapRef.current) return;

    if (directionsResult) {
      directionsRendererRef.current.setDirections(directionsResult);
      const bounds = directionsResult.routes?.[0]?.bounds;
      if (bounds) mapRef.current.fitBounds(bounds, { top: 50, bottom: 50, left: 40, right: 40 });
    } else {
      directionsRendererRef.current.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
      mapRef.current.setCenter(SEATTLE_CENTER);
      mapRef.current.setZoom(12);
    }
  }, [directionsResult]);

  // ── Custom markers ─────────────────────────────────────────────────
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || typeof google === 'undefined' || !google.maps?.Marker) return;

    // Pickup marker
    if (pickup) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setPosition(pickup);
      } else {
        pickupMarkerRef.current = new google.maps.Marker({
          position: pickup,
          map: mapRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#34C759',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
          },
          zIndex: 10,
        });
      }
    } else {
      pickupMarkerRef.current?.setMap(null);
      pickupMarkerRef.current = null;
    }

    // Dropoff marker
    if (dropoff) {
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setPosition(dropoff);
      } else {
        dropoffMarkerRef.current = new google.maps.Marker({
          position: dropoff,
          map: mapRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#1D1D1F',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
          },
          zIndex: 10,
        });
      }
    } else {
      dropoffMarkerRef.current?.setMap(null);
      dropoffMarkerRef.current = null;
    }
  }, [pickup, dropoff, mapsReady]);

  // ── Autocomplete ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || typeof google === 'undefined' || !google.maps?.places?.Autocomplete) return;
    const bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(47.4, -122.5),
      new google.maps.LatLng(47.8, -122.1),
    );
    const opts = { fields: ['formatted_address', 'geometry'] as string[], bounds, componentRestrictions: { country: 'us' } };

    if (pickupInputRef.current && !pickupAcRef.current) {
      const ac = new google.maps.places.Autocomplete(pickupInputRef.current, opts);
      ac.addListener('place_changed', () => {
        const p = ac.getPlace();
        if (p.geometry?.location && p.formatted_address) {
          setPickup({ lat: p.geometry.location.lat(), lng: p.geometry.location.lng(), address: p.formatted_address });
          setPickupText(p.formatted_address);
          setBooked(false);
        }
      });
      pickupAcRef.current = ac;
    }
    if (dropoffInputRef.current && !dropoffAcRef.current) {
      const ac = new google.maps.places.Autocomplete(dropoffInputRef.current, opts);
      ac.addListener('place_changed', () => {
        const p = ac.getPlace();
        if (p.geometry?.location && p.formatted_address) {
          setDropoff({ lat: p.geometry.location.lat(), lng: p.geometry.location.lng(), address: p.formatted_address });
          setDropoffText(p.formatted_address);
          setBooked(false);
        }
      });
      dropoffAcRef.current = ac;
    }
  }, [mapsReady]);

  // ── Confirm ride ───────────────────────────────────────────────────
  const confirmRide = useCallback(async () => {
    if (!user) { router.push('/auth/login?redirect=/'); return; }
    if (!pickup || !dropoff || !route || !selectedFare) return;

    setBooking(true);
    setBookingError('');
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng,
          destinationAddress: dropoff.address, destinationLat: dropoff.lat, destinationLng: dropoff.lng,
          distanceKm: route.distanceKm, durationMin: route.durationMin, vehicleType: selectedTier,
        }),
      });
      const data = await res.json().catch(() => ({})) as { checkoutUrl?: string; error?: string };
      if (!res.ok) {
        if (res.status === 401) { router.push('/auth/login?redirect=/'); return; }
        throw new Error(data.error || 'Booking failed');
      }
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      setBooked(true);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Could not book ride.');
    } finally {
      setBooking(false);
    }
  }, [user, pickup, dropoff, route, selectedFare, selectedTier, router]);

  // ── Booked ─────────────────────────────────────────────────────────
  if (booked) {
    return (
      <div className="overflow-hidden rounded-3xl border border-[#E5E5EA] bg-white">
        <div className="p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#34C759]/10">
            <svg className="h-8 w-8 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <p className="mt-5 text-[20px] font-semibold text-[#1D1D1F]">Ride confirmed</p>
          <p className="mt-2 text-[14px] text-[#86868B] leading-relaxed">{pickup?.address}<br />→ {dropoff?.address}</p>
          <p className="mt-4 text-[28px] font-bold tabular-nums text-[#1D1D1F]">${selectedFare?.total.toFixed(2)}</p>
          <button onClick={() => router.push('/dashboard')} className="mt-6 flex w-full items-center justify-center rounded-2xl bg-[#1D1D1F] py-4 text-[16px] font-semibold text-white hover:bg-[#333]">
            Track your ride
          </button>
        </div>
      </div>
    );
  }

  const ctaLabel = booking ? 'Booking...' : routeLoading ? 'Calculating route...' : !user ? 'Sign in to book' : hasRoute ? `Confirm ride · $${selectedFare?.total.toFixed(2)}` : 'Enter pickup & destination';
  const ctaDisabled = booking || routeLoading || (!!user && !hasRoute);
  const ctaAction = () => { if (!user) router.push('/auth/login?redirect=/'); else if (hasRoute) confirmRide(); };

  return (
    <div className="overflow-hidden rounded-3xl border border-[#E5E5EA] bg-white">

      {/* ── Live map ──────────────────────────────────────────────── */}
      <div className="relative h-[240px] bg-[#EEEEF2] overflow-hidden">
        {/* Google Map canvas */}
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Loading state when map isn't ready */}
        {!mapsReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#EEEEF2] z-10">
            {mapsFailed ? (
              <p className="text-[13px] text-[#86868B]">Map unavailable</p>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#D2D2D7] border-t-[#86868B]" />
                <span className="text-[13px] text-[#86868B]">Loading map</span>
              </div>
            )}
          </div>
        )}

        {/* Route info overlay */}
        {hasRoute && (
          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between rounded-2xl bg-white/95 px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-0.5">
                <div className="h-2 w-2 rounded-full bg-[#34C759]" />
                <div className="h-3 w-[1.5px] bg-[#D2D2D7]" />
                <div className="h-2 w-2 rounded-full bg-[#1D1D1F]" />
              </div>
              <div className="text-[12px] leading-tight">
                <p className="font-medium text-[#1D1D1F] truncate max-w-[140px]">{pickup?.address?.split(',')[0]}</p>
                <p className="font-medium text-[#86868B] truncate max-w-[140px] mt-1">{dropoff?.address?.split(',')[0]}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[18px] font-bold tabular-nums text-[#1D1D1F]">{distanceMiles}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">mi</p>
              </div>
              <div>
                <p className="text-[18px] font-bold tabular-nums text-[#1D1D1F]">{route!.durationMin}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">min</p>
              </div>
            </div>
          </div>
        )}

        {routeLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#D2D2D7] border-t-[#1D1D1F]" />
              <span className="text-[12px] font-medium text-[#1D1D1F]">Calculating route</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Booking form ──────────────────────────────────────────── */}
      <div className="p-5">
        {(bookingError || routeError) && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-[#FF3B30]/8 px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
            <p className="text-[13px] font-medium text-[#1D1D1F]">{bookingError || routeError}</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-[#E5E5EA] bg-white px-4 py-3.5 focus-within:border-[#1D1D1F] transition-colors">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#34C759]" />
            <input ref={pickupInputRef} type="text" placeholder="Pickup location" value={pickupText}
              onChange={(e) => { setPickupText(e.target.value); setPickup(null); }}
              className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#C7C7CC] outline-none" />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#E5E5EA] bg-white px-4 py-3.5 focus-within:border-[#1D1D1F] transition-colors">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1D1D1F]" />
            <input ref={dropoffInputRef} type="text" placeholder="Where to?" value={dropoffText}
              onChange={(e) => { setDropoffText(e.target.value); setDropoff(null); }}
              className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#C7C7CC] outline-none" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#E5E5EA] px-4 py-3">
            <svg className="h-4 w-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
            <span className="text-[14px] font-medium text-[#1D1D1F]">Today</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-[#E5E5EA] px-4 py-3">
            <svg className="h-4 w-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            <span className="text-[14px] font-medium text-[#1D1D1F]">Now</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {SEATTLE_TIERS.map(tier => {
            const active = selectedTier === tier.id;
            const fare = fares.find(f => f.vehicleClass === tier.id);
            return (
              <button key={tier.id} onClick={() => setSelectedTier(tier.id)}
                className={`flex-1 rounded-xl border py-3.5 text-center transition-all duration-150 ${active ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]' : 'border-[#E5E5EA] bg-white text-[#1D1D1F] hover:border-[#C7C7CC]'}`}>
                <p className="text-[18px] leading-none">{tier.icon}</p>
                <p className={`mt-2 text-[13px] font-semibold ${active ? 'text-white' : 'text-[#1D1D1F]'}`}>{tier.name}</p>
                <p className={`mt-0.5 text-[12px] tabular-nums font-medium ${active ? 'text-white/60' : 'text-[#86868B]'}`}>{fare ? `$${fare.total.toFixed(2)}` : '—'}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F5F5F7] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Estimated fare</p>
            <p className="mt-1 text-[26px] font-bold tabular-nums tracking-tight text-[#1D1D1F]">
              {routeLoading ? <span className="inline-block h-6 w-20 animate-pulse rounded bg-[#E5E5EA]" /> : selectedFare ? `$${selectedFare.total.toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Distance</p>
            <p className="mt-1 text-[18px] font-bold tabular-nums text-[#1D1D1F]">{distanceMiles ? `${distanceMiles} mi` : '—'}</p>
          </div>
        </div>

        <button onClick={ctaAction} disabled={!!ctaDisabled}
          className={`mt-4 flex w-full items-center justify-center rounded-2xl py-4 text-[16px] font-semibold transition-all duration-200 ${ctaDisabled ? 'bg-[#E5E5EA] text-[#A1A1A6]' : 'bg-[#1D1D1F] text-white hover:bg-[#333] active:scale-[0.98]'}`}>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
