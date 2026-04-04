'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleMaps } from './GoogleMapsProvider';
import { useAuth } from '@/lib/auth/context';
import PaymentModal from './PaymentModal';
import type { QuoteResult } from '@/lib/pricing';

// ── Types ────────────────────────────────────────────────────────────────

interface LocationState { lat: number; lng: number; address: string }
interface RouteInfo { distanceKm: number; durationMin: number; polyline: string }

type VehicleClass = 'economy' | 'comfort' | 'premium';
const TIERS: { id: VehicleClass; name: string; icon: string }[] = [
  { id: 'economy', name: 'Economy', icon: '🚗' },
  { id: 'comfort', name: 'Comfort', icon: '🚙' },
  { id: 'premium', name: 'Premium', icon: '🚘' },
];

// ── Component ────────────────────────────────────────────────────────────

export default function HeroBooking({ ctaHref }: { ctaHref: string }) {
  const { isLoaded, status } = useGoogleMaps();
  const { user } = useAuth();
  const router = useRouter();

  const [pickup, setPickup] = useState<LocationState | null>(null);
  const [dropoff, setDropoff] = useState<LocationState | null>(null);
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [quotes, setQuotes] = useState<QuoteResult[]>([]);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [selectedTier, setSelectedTier] = useState<VehicleClass>('comfort');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [booked, setBooked] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [rideData, setRideData] = useState<{ id: string; distanceKm: number; durationMin: number; totalFare: number; currency: string } | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupAcRef = useRef<google.maps.places.Autocomplete | null>(null);
  const dropoffAcRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const selectedQuote = quotes.find(q => q.vehicleClass === selectedTier);
  const hasRoute = !!(pickup && dropoff && route && quotes.length > 0);

  // ── Fetch quotes ───────────────────────────────────────────────────
  const fetchQuotes = useCallback(async (p: LocationState, d: LocationState) => {
    setQuoteLoading(true);
    setBookingError('');
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup: p, dropoff: d, currency: 'USD', persist: false }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuotes(data.quotes ?? []);
      if (data.route) setRoute({ distanceKm: data.route.distanceKm, durationMin: data.route.durationMin, polyline: data.route.polyline });
    } catch { setBookingError('Could not calculate route. Try different locations.'); }
    finally { setQuoteLoading(false); }
  }, []);

  // ── Directions for map ─────────────────────────────────────────────
  useEffect(() => {
    if (!pickup || !dropoff || !isLoaded) { setDirections(null); return; }
    // Guard: verify google.maps constructors actually exist
    if (typeof google === 'undefined' || !google.maps?.DirectionsService) return;
    try {
      new google.maps.DirectionsService().route(
        {
          origin: new google.maps.LatLng(pickup.lat, pickup.lng),
          destination: new google.maps.LatLng(dropoff.lat, dropoff.lng),
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, s) => {
          if (s === google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
            const bounds = result.routes?.[0]?.bounds;
            if (mapRef.current && bounds) mapRef.current.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
          }
        },
      );
    } catch (err) {
      console.error('[HeroBooking] Directions failed:', err);
    }
  }, [pickup, dropoff, isLoaded]);

  // ── Place handlers ─────────────────────────────────────────────────
  const onPickup = useCallback(() => {
    const place = pickupAcRef.current?.getPlace();
    if (!place?.geometry?.location || !place.formatted_address) return;
    const loc = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), address: place.formatted_address };
    setPickup(loc); setPickupText(place.formatted_address); setBooked(false);
    if (dropoff) fetchQuotes(loc, dropoff);
  }, [dropoff, fetchQuotes]);

  const onDropoff = useCallback(() => {
    const place = dropoffAcRef.current?.getPlace();
    if (!place?.geometry?.location || !place.formatted_address) return;
    const loc = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), address: place.formatted_address };
    setDropoff(loc); setDropoffText(place.formatted_address); setBooked(false);
    if (pickup) fetchQuotes(pickup, loc);
  }, [pickup, fetchQuotes]);

  // ── Confirm ride ───────────────────────────────────────────────────
  const confirmRide = useCallback(async () => {
    if (!user) { router.push('/auth/signup'); return; }
    const quote = quotes.find(q => q.vehicleClass === selectedTier);
    if (!pickup || !dropoff || !route || !quote) return;

    setBooking(true); setBookingError('');
    try {
      const res = await fetch('/api/rides/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: pickup.address, pickupLat: pickup.lat, pickupLng: pickup.lng,
          dropoffAddress: dropoff.address, dropoffLat: dropoff.lat, dropoffLng: dropoff.lng,
          distanceKm: route.distanceKm, durationMin: route.durationMin, polyline: route.polyline,
          vehicleClass: selectedTier,
          baseFare: quote.fare.baseFare, distanceFare: quote.fare.distanceFare,
          timeFare: quote.fare.timeFare, totalFare: quote.fare.total,
          surgeMultiplier: quote.fare.surgeMultiplier, currency: quote.fare.currency,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) { router.push('/auth/signup'); return; }
        const errData = await res.json();
        throw new Error(errData.error || 'Booking failed');
      }
      const data = await res.json();
      const rideId = data.ride?.id || data.id || 'unknown';
      setRideData({
        id: rideId,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        totalFare: quote.fare.total,
        currency: quote.fare.currency || 'USD',
      });
      setShowPayment(true);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Could not book ride. Please try again.');
    } finally { setBooking(false); }
  }, [user, pickup, dropoff, route, quotes, selectedTier, router]);

  // ── Lazy import Google Maps components ─────────────────────────────
  // These are only used when isLoaded is true, avoiding any reference
  // to google.maps.* when the script hasn't loaded
  const renderMap = () => {
    if (!isLoaded) return null;
    // Guard: constructors must exist before rendering
    if (typeof google === 'undefined' || !google.maps?.Map) return null;
    try {
      const { GoogleMap, Marker, DirectionsRenderer } = require('@react-google-maps/api');
      const pinSvg = (fill: string) => 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
        `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="10" fill="${fill}" opacity="0.15"/><circle cx="14" cy="14" r="6" fill="${fill}"/><circle cx="14" cy="14" r="2.5" fill="white"/></svg>`
      );
      const styles = [
        { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#6E6E73' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D6E4F0' }] },
        { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F0F0F3' }] },
        { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
        { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
      ];
      return (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={pickup || { lat: 47.6062, lng: -122.3321 }}
          zoom={12}
          onLoad={(map: google.maps.Map) => { mapRef.current = map; }}
          options={{ styles, disableDefaultUI: true, zoomControl: false, clickableIcons: false }}
        >
          {pickup && <Marker position={pickup} icon={{ url: pinSvg('#1D6AE5'), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) }} />}
          {dropoff && <Marker position={dropoff} icon={{ url: pinSvg('#1D1D1F'), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) }} />}
          {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#1D1D1F', strokeWeight: 4, strokeOpacity: 0.7 } }} />}
        </GoogleMap>
      );
    } catch (err) {
      console.error('[HeroBooking] Map render failed:', err);
      return null;
    }
  };

  const renderAutocomplete = (type: 'pickup' | 'dropoff') => {
    if (!isLoaded) {
      return (
        <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-4 py-3.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${type === 'pickup' ? 'bg-[#1D6AE5]' : 'bg-[#1D1D1F]'}`} />
          <input
            type="text"
            placeholder={type === 'pickup' ? 'Pickup location' : 'Where to?'}
            value={type === 'pickup' ? pickupText : dropoffText}
            onChange={(e) => type === 'pickup' ? setPickupText(e.target.value) : setDropoffText(e.target.value)}
            className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
          />
        </div>
      );
    }
    try {
      const { Autocomplete } = require('@react-google-maps/api');
      return (
        <Autocomplete
          onLoad={(ac: google.maps.places.Autocomplete) => { type === 'pickup' ? pickupAcRef.current = ac : dropoffAcRef.current = ac; }}
          onPlaceChanged={type === 'pickup' ? onPickup : onDropoff}
          options={{ fields: ['formatted_address', 'geometry', 'place_id'] }}
        >
          <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-4 py-3.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${type === 'pickup' ? 'bg-[#1D6AE5]' : 'bg-[#1D1D1F]'}`} />
            <input
              type="text"
              placeholder={type === 'pickup' ? 'Pickup location' : 'Where to?'}
              value={type === 'pickup' ? pickupText : dropoffText}
              onChange={(e) => type === 'pickup' ? setPickupText(e.target.value) : setDropoffText(e.target.value)}
              className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
            />
          </div>
        </Autocomplete>
      );
    } catch (err) {
      console.error('[HeroBooking] Autocomplete failed:', err);
      // Fall back to plain input
      return (
        <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-4 py-3.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${type === 'pickup' ? 'bg-[#1D6AE5]' : 'bg-[#1D1D1F]'}`} />
          <input
            type="text"
            placeholder={type === 'pickup' ? 'Pickup location' : 'Where to?'}
            value={type === 'pickup' ? pickupText : dropoffText}
            onChange={(e) => type === 'pickup' ? setPickupText(e.target.value) : setDropoffText(e.target.value)}
            className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
          />
        </div>
      );
    }
  };

  // ── Payment state ──────────────────────────────────────────────────
  if (showPayment && rideData) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">
        <div className="p-6">
          <p className="mb-4 text-center text-[16px] font-semibold text-[#1D1D1F]">Complete payment</p>
          <div className="mb-4 flex items-center justify-between rounded-xl bg-[#f5f5f7] px-4 py-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Total fare</p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums text-[#1D1D1F]">
                ${rideData.totalFare.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Distance</p>
              <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#1D1D1F]">
                {rideData.distanceKm} km
              </p>
            </div>
          </div>
          <PaymentModal
            trip={{
              tripId: rideData.id,
              distance: rideData.distanceKm,
              duration: rideData.durationMin,
              fare: rideData.totalFare,
              currency: rideData.currency,
            }}
            onComplete={() => {
              setShowPayment(false);
              setBooked(true);
            }}
            onDismiss={() => {
              setShowPayment(false);
              setBookingError('Payment cancelled. Your ride has been saved — you can pay later from your dashboard.');
            }}
            formatCurrency={(amount: number) => `$${amount.toFixed(2)}`}
            formatDistance={(km: number) => `${km} km`}
          />
        </div>
      </div>
    );
  }

  // ── Booked state ───────────────────────────────────────────────────
  if (booked) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">
        <div className="p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1D6AE5]/10">
            <svg className="h-7 w-7 text-[#1D6AE5]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <p className="mt-4 text-[18px] font-semibold text-[#1D1D1F]">Ride confirmed</p>
          <p className="mt-1 text-[14px] text-[#86868B]">
            {pickup?.address} → {dropoff?.address}
          </p>
          <p className="mt-3 text-[22px] font-bold tabular-nums text-[#1D1D1F]">
            ${selectedQuote?.fare.total.toFixed(2)}
          </p>
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

  // ── CTA label ──────────────────────────────────────────────────────
  const ctaLabel = booking
    ? 'Booking...'
    : quoteLoading
      ? 'Calculating...'
      : !user
        ? 'Sign in to book'
        : hasRoute
          ? `Confirm ride · $${selectedQuote?.fare.total.toFixed(2)}`
          : 'Enter pickup & destination';

  const ctaDisabled = booking || quoteLoading || (user && !hasRoute);
  const ctaAction = () => {
    if (!user) { router.push(ctaHref); return; }
    if (hasRoute) confirmRide();
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">

      {/* Map */}
      <div className="relative h-[260px] bg-[#F2F2F7] overflow-hidden">
        {isLoaded ? renderMap() : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3">
            {status === 'degraded' ? (
              <p className="text-[13px] text-[#86868B]">Enter locations below</p>
            ) : (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8E8ED] border-t-[#1D1D1F]" />
                <p className="text-[12px] text-[#A1A1A6]">Loading map</p>
              </>
            )}
          </div>
        )}

        {hasRoute && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1D6AE5] opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1D6AE5]" />
            </span>
            <span className="text-[12px] font-semibold text-[#1D1D1F]">{route!.durationMin} min · {route!.distanceKm} km</span>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="p-5">
        {bookingError && (
          <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-[#FFF5F5] px-4 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
            <p className="text-[13px] text-[#1D1D1F]">{bookingError}</p>
          </div>
        )}

        {/* Inputs */}
        <div className="space-y-2">
          {renderAutocomplete('pickup')}
          {renderAutocomplete('dropoff')}
        </div>

        {/* Date/Time */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#f5f5f7] px-4 py-3">
            <svg className="h-4 w-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className="text-[14px] font-medium text-[#1D1D1F]">Today</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-[#f5f5f7] px-4 py-3">
            <svg className="h-4 w-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-[14px] font-medium text-[#1D1D1F]">Now</span>
          </div>
        </div>

        {/* Vehicle selector */}
        <div className="mt-4 flex gap-2">
          {TIERS.map(tier => {
            const active = selectedTier === tier.id;
            const quote = quotes.find(q => q.vehicleClass === tier.id);
            return (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`flex-1 rounded-xl px-2 py-3 text-center transition-all duration-150 ${
                  active ? 'bg-[#1D1D1F] text-white' : 'bg-[#f5f5f7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
                }`}
              >
                <p className="text-[16px] leading-none">{tier.icon}</p>
                <p className={`mt-1.5 text-[12px] font-semibold ${active ? 'text-white' : 'text-[#1D1D1F]'}`}>{tier.name}</p>
                <p className={`mt-0.5 text-[11px] tabular-nums ${active ? 'text-white/60' : 'text-[#86868B]'}`}>
                  {quote ? `$${quote.fare.total.toFixed(2)}` : '—'}
                </p>
              </button>
            );
          })}
        </div>

        {/* Fare */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f5f5f7] px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Estimated fare</p>
            <p className="mt-0.5 text-[22px] font-bold tabular-nums tracking-tight text-[#1D1D1F]">
              {quoteLoading ? <span className="inline-block h-5 w-16 animate-pulse rounded bg-[#E8E8ED]" />
                : selectedQuote ? `$${selectedQuote.fare.total.toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Distance</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#1D1D1F]">
              {route ? `${route.distanceKm} km` : '—'}
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={ctaAction}
          disabled={!!ctaDisabled}
          className={`mt-3 flex w-full items-center justify-center rounded-xl py-3.5 text-[15px] font-medium transition-colors duration-200 ${
            !ctaDisabled
              ? 'bg-[#1D1D1F] text-white hover:bg-[#424245]'
              : 'bg-[#E8E8ED] text-[#A1A1A6]'
          }`}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
