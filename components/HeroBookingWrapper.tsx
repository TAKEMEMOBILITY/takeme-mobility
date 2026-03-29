'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useGoogleMapsLoader } from '@/lib/useGoogleMapsLoader';
import { useDirections } from '@/lib/useDirections';
import { SEATTLE_TIERS, calculateAllFares, kmToMiles, type VehicleClass, type FareResult } from '@/lib/seattle-pricing';

// ═══════════════════════════════════════════════════════════════════════════
// HeroBookingWrapper — Production booking card for Seattle
//
// Google Maps loaded via callback (not module-level). Autocomplete and
// Directions only used after google.maps.Map is verified. Falls back
// to plain text inputs if Maps fails.
// ═══════════════════════════════════════════════════════════════════════════

interface LatLng { lat: number; lng: number }
interface LocationState extends LatLng { address: string }

export default function HeroBookingWrapper({ ctaHref }: { ctaHref: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { ready: mapsReady, failed: mapsFailed } = useGoogleMapsLoader();

  // Location state
  const [pickup, setPickup] = useState<LocationState | null>(null);
  const [dropoff, setDropoff] = useState<LocationState | null>(null);
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [selectedTier, setSelectedTier] = useState<VehicleClass>('comfort');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Autocomplete refs
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const pickupAcRef = useRef<google.maps.places.Autocomplete | null>(null);
  const dropoffAcRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Route calculation
  const { route, loading: routeLoading, error: routeError } = useDirections(pickup, dropoff, mapsReady);

  // Fares — recalculated whenever route or tier changes
  const fares: FareResult[] = route ? calculateAllFares(route.distanceKm, route.durationMin) : [];
  const selectedFare = fares.find(f => f.vehicleClass === selectedTier);
  const distanceMiles = route ? kmToMiles(route.distanceKm) : null;

  // ── Attach Google Places Autocomplete ──────────────────────────────
  useEffect(() => {
    if (!mapsReady || typeof google === 'undefined' || !google.maps?.places?.Autocomplete) return;

    // Pickup
    // Seattle bias: 50km radius around downtown
    const seattleBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(47.4, -122.5),  // SW
      new google.maps.LatLng(47.8, -122.1),  // NE
    );

    const acOptions = {
      fields: ['formatted_address', 'geometry'] as string[],
      bounds: seattleBounds,
      componentRestrictions: { country: 'us' },
    };

    if (pickupInputRef.current && !pickupAcRef.current) {
      const ac = new google.maps.places.Autocomplete(pickupInputRef.current, acOptions);
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place.geometry?.location && place.formatted_address) {
          setPickup({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), address: place.formatted_address });
          setPickupText(place.formatted_address);
          setBooked(false);
        }
      });
      pickupAcRef.current = ac;
    }

    if (dropoffInputRef.current && !dropoffAcRef.current) {
      const ac = new google.maps.places.Autocomplete(dropoffInputRef.current, acOptions);
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place.geometry?.location && place.formatted_address) {
          setDropoff({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), address: place.formatted_address });
          setDropoffText(place.formatted_address);
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
          pickupAddress: pickup.address,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          destinationAddress: dropoff.address,
          destinationLat: dropoff.lat,
          destinationLng: dropoff.lng,
          distanceKm: route.distanceKm,
          durationMin: route.durationMin,
          vehicleType: selectedTier,
        }),
      });

      const data = await res.json().catch(() => ({})) as { checkoutUrl?: string; error?: string };

      if (!res.ok) {
        if (res.status === 401) { router.push('/auth/login?redirect=/'); return; }
        throw new Error(data.error || 'Booking failed');
      }

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setBooked(true);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Could not book ride.');
    } finally {
      setBooking(false);
    }
  }, [user, pickup, dropoff, route, selectedTier, ctaHref, router]);

  // ── Booked confirmation ────────────────────────────────────────────
  if (booked) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">
        <div className="p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#34C759]/10">
            <svg className="h-7 w-7 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <p className="mt-4 text-[18px] font-semibold text-[#1D1D1F]">Ride confirmed</p>
          <p className="mt-1 text-[14px] text-[#86868B]">{pickup?.address} → {dropoff?.address}</p>
          <p className="mt-3 text-[22px] font-bold tabular-nums text-[#1D1D1F]">${selectedFare?.total.toFixed(2)}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#1D1D1F] py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]"
          >
            Track your ride
          </button>
        </div>
      </div>
    );
  }

  // ── CTA logic ──────────────────────────────────────────────────────
  const hasRoute = !!(pickup && dropoff && route && fares.length > 0);

  const ctaLabel = booking ? 'Booking...'
    : routeLoading ? 'Calculating route...'
    : !user ? 'Sign in to book'
    : hasRoute ? `Confirm ride · $${selectedFare?.total.toFixed(2)}`
    : 'Enter pickup & destination';

  const ctaDisabled = booking || routeLoading || (!!user && !hasRoute);

  const ctaAction = () => {
    if (!user) { router.push('/auth/login?redirect=/'); return; }
    if (hasRoute) confirmRide();
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">

      {/* Route preview area */}
      <div className="relative h-[200px] bg-[#F2F2F7] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08]">
          {[20,40,60,80].map(p => <div key={`h${p}`} className="absolute h-[1px] w-full bg-[#86868B]" style={{ top: `${p}%` }} />)}
          {[25,50,75].map(p => <div key={`v${p}`} className="absolute h-full w-[1px] bg-[#86868B]" style={{ left: `${p}%` }} />)}
        </div>

        {routeLoading && (
          <div className="relative z-10 flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8E8ED] border-t-[#1D1D1F]" />
            <span className="text-[13px] text-[#86868B]">Calculating route...</span>
          </div>
        )}

        {hasRoute && !routeLoading && (
          <div className="relative z-10 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34C759] opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34C759]" />
            </span>
            <span className="text-[13px] font-semibold text-[#1D1D1F]">
              {distanceMiles} mi · {route!.durationMin} min
            </span>
          </div>
        )}

        {!hasRoute && !routeLoading && (
          <p className="relative z-10 text-[13px] text-[#A1A1A6]">
            {mapsFailed ? 'Enter locations to get a quote' : mapsReady ? 'Select pickup & destination' : 'Loading...'}
          </p>
        )}
      </div>

      {/* Form */}
      <div className="p-5">
        {(bookingError || routeError) && (
          <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-[#FFF5F5] px-4 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
            <p className="text-[13px] text-[#1D1D1F]">{bookingError || routeError}</p>
          </div>
        )}

        {/* Location inputs — Google Places Autocomplete attaches to these */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#34C759]" />
            <input
              ref={pickupInputRef}
              type="text"
              placeholder="Pickup location"
              value={pickupText}
              onChange={(e) => { setPickupText(e.target.value); setPickup(null); }}
              className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1D1D1F]" />
            <input
              ref={dropoffInputRef}
              type="text"
              placeholder="Where to?"
              value={dropoffText}
              onChange={(e) => { setDropoffText(e.target.value); setDropoff(null); }}
              className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
            />
          </div>
        </div>

        {/* Date / Time */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#F5F5F7] px-4 py-3">
            <svg className="h-4 w-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className="text-[14px] font-medium text-[#1D1D1F]">Today</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-[#F5F5F7] px-4 py-3">
            <svg className="h-4 w-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-[14px] font-medium text-[#1D1D1F]">Now</span>
          </div>
        </div>

        {/* Vehicle tier selector */}
        <div className="mt-4 flex gap-2">
          {SEATTLE_TIERS.map(tier => {
            const active = selectedTier === tier.id;
            const fare = fares.find(f => f.vehicleClass === tier.id);
            return (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`flex-1 rounded-xl px-2 py-3 text-center transition-all duration-150 ${
                  active ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
                }`}
              >
                <p className="text-[16px] leading-none">{tier.icon}</p>
                <p className={`mt-1.5 text-[12px] font-semibold ${active ? 'text-white' : 'text-[#1D1D1F]'}`}>{tier.name}</p>
                <p className={`mt-0.5 text-[11px] tabular-nums ${active ? 'text-white/60' : 'text-[#86868B]'}`}>
                  {fare ? `$${fare.total.toFixed(2)}` : '—'}
                </p>
              </button>
            );
          })}
        </div>

        {/* Fare + distance */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F5F5F7] px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Estimated fare</p>
            <p className="mt-0.5 text-[22px] font-bold tabular-nums tracking-tight text-[#1D1D1F]">
              {routeLoading
                ? <span className="inline-block h-5 w-16 animate-pulse rounded bg-[#E8E8ED]" />
                : selectedFare
                  ? `$${selectedFare.total.toFixed(2)}`
                  : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Distance</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#1D1D1F]">
              {distanceMiles ? `${distanceMiles} mi` : '—'}
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={ctaAction}
          disabled={!!ctaDisabled}
          className={`mt-3 flex w-full items-center justify-center rounded-xl py-3.5 text-[15px] font-medium transition-colors duration-200 ${
            ctaDisabled ? 'bg-[#E8E8ED] text-[#A1A1A6]' : 'bg-[#1D1D1F] text-white hover:bg-[#424245]'
          }`}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
