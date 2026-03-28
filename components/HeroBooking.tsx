'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleMap, Marker, DirectionsRenderer, Autocomplete } from '@react-google-maps/api';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useGoogleMaps } from './GoogleMapsProvider';
import { useAuth } from '@/lib/auth/context';
import RideTracker from './RideTracker';
import type { QuoteResult } from '@/lib/pricing';

// NEVER call loadStripe with empty key — it crashes the Stripe SDK
const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (!STRIPE_KEY) return Promise.resolve(null);
  if (!stripePromise) {
    try {
      stripePromise = loadStripe(STRIPE_KEY);
    } catch {
      stripePromise = Promise.resolve(null);
    }
  }
  return stripePromise;
}

// ── Types ────────────────────────────────────────────────────────────────

interface LocationState {
  lat: number;
  lng: number;
  address: string;
}

interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  polyline: string;
}

interface CreatedRide {
  id: string;
  status: string;
  estimatedFare: number;
  currency: string;
  clientSecret: string | null;
}

type VehicleClass = 'economy' | 'comfort' | 'premium';

const TIER_ICONS: Record<VehicleClass, string> = {
  economy: '🚗',
  comfort: '🚙',
  premium: '🚘',
};

// ── Map style ────────────────────────────────────────────────────────────

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

// ── Inline payment form (used inside confirmed card) ─────────────────────

function InlinePaymentForm({ onSuccess, onError }: {
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message ?? 'Payment failed');
      setProcessing(false);
    } else {
      onSuccess();
    }
  }, [stripe, elements, onSuccess, onError]);

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        className="mt-3 flex w-full items-center justify-center rounded-xl bg-[#1D1D1F] py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245] disabled:opacity-40"
      >
        {processing ? 'Processing...' : 'Pay now'}
      </button>
    </form>
  );
}

// ── Component ────────────────────────────────────────────────────────────

export default function HeroBooking({ ctaHref }: { ctaHref: string }) {
  const { isLoaded, status } = useGoogleMaps();
  const { user } = useAuth();
  const router = useRouter();

  // Location state
  const [pickup, setPickup] = useState<LocationState | null>(null);
  const [dropoff, setDropoff] = useState<LocationState | null>(null);
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');

  // Quote state
  const [quotes, setQuotes] = useState<QuoteResult[]>([]);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [selectedTier, setSelectedTier] = useState<VehicleClass>('comfort');
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Booking state
  const [booking, setBooking] = useState(false);
  const [createdRide, setCreatedRide] = useState<CreatedRide | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Map state
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Autocomplete refs
  const pickupAcRef = useRef<google.maps.places.Autocomplete | null>(null);
  const dropoffAcRef = useRef<google.maps.places.Autocomplete | null>(null);

  // ── Fetch quotes from API ──────────────────────────────────────────
  const fetchQuotes = useCallback(async (p: LocationState, d: LocationState) => {
    setQuoteLoading(true);
    setBookingError('');
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup: { lat: p.lat, lng: p.lng, address: p.address },
          dropoff: { lat: d.lat, lng: d.lng, address: d.address },
          currency: 'USD',
          persist: false,
        }),
      });
      if (!res.ok) throw new Error('Quote fetch failed');
      const data = await res.json();
      setQuotes(data.quotes ?? []);
      setRoute(data.route ? {
        distanceKm: data.route.distanceKm,
        durationMin: data.route.durationMin,
        polyline: data.route.polyline,
      } : null);
    } catch (err) {
      console.error('Quote error:', err);
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  // ── Create ride ────────────────────────────────────────────────────
  const confirmRide = useCallback(async () => {
    if (!user) {
      router.push('/auth/signup');
      return;
    }

    const quote = quotes.find(q => q.vehicleClass === selectedTier);
    if (!pickup || !dropoff || !route || !quote) return;

    setBooking(true);
    setBookingError('');

    try {
      const res = await fetch('/api/rides/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: pickup.address,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffAddress: dropoff.address,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          distanceKm: route.distanceKm,
          durationMin: route.durationMin,
          polyline: route.polyline,
          vehicleClass: selectedTier,
          baseFare: quote.fare.baseFare,
          distanceFare: quote.fare.distanceFare,
          timeFare: quote.fare.timeFare,
          totalFare: quote.fare.total,
          surgeMultiplier: quote.fare.surgeMultiplier,
          currency: quote.fare.currency,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/auth/signup');
          return;
        }
        throw new Error(data.error || 'Booking failed');
      }

      setCreatedRide({
        ...data.ride,
        clientSecret: data.payment?.clientSecret ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not book ride. Please try again.';
      setBookingError(msg);
    } finally {
      setBooking(false);
    }
  }, [user, pickup, dropoff, route, quotes, selectedTier, router]);

  // ── Calculate directions for map ───────────────────────────────────
  useEffect(() => {
    if (!pickup || !dropoff || !isLoaded) {
      setDirections(null);
      return;
    }
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: new google.maps.LatLng(pickup.lat, pickup.lng),
        destination: new google.maps.LatLng(dropoff.lat, dropoff.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, dirStatus) => {
        if (dirStatus === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          if (mapRef.current) {
            const bounds = result.routes?.[0]?.bounds;
            if (bounds) mapRef.current.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
          }
        }
      },
    );
  }, [pickup, dropoff, isLoaded]);

  // ── Place selection handlers ───────────────────────────────────────
  const onPickupPlace = useCallback(() => {
    const place = pickupAcRef.current?.getPlace();
    if (!place?.geometry?.location || !place.formatted_address) return;
    const loc: LocationState = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      address: place.formatted_address,
    };
    setPickup(loc);
    setPickupText(place.formatted_address);
    setCreatedRide(null);
    if (dropoff) fetchQuotes(loc, dropoff);
  }, [dropoff, fetchQuotes]);

  const onDropoffPlace = useCallback(() => {
    const place = dropoffAcRef.current?.getPlace();
    if (!place?.geometry?.location || !place.formatted_address) return;
    const loc: LocationState = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      address: place.formatted_address,
    };
    setDropoff(loc);
    setDropoffText(place.formatted_address);
    setCreatedRide(null);
    if (pickup) fetchQuotes(pickup, loc);
  }, [pickup, fetchQuotes]);

  // ── Derived ────────────────────────────────────────────────────────
  const selectedQuote = quotes.find(q => q.vehicleClass === selectedTier);
  const hasRoute = pickup && dropoff && route && quotes.length > 0;
  const defaultCenter = { lat: 40.7128, lng: -74.006 };

  // ── Render: Ride confirmed — payment then live tracking ──────────────
  if (createdRide) {
    const resetBooking = () => {
      setCreatedRide(null);
      setPaymentDone(false);
      setPickup(null);
      setDropoff(null);
      setPickupText('');
      setDropoffText('');
      setQuotes([]);
      setRoute(null);
      setDirections(null);
    };

    // After payment or no payment needed: show live ride tracker
    if (paymentDone || !createdRide.clientSecret || !STRIPE_KEY) {
      return <RideTracker rideId={createdRide.id} onClose={resetBooking} />;
    }

    // Before payment: show Stripe form (only if Stripe is available)
    const stripe = getStripe();

    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F7]">
              <svg className="h-5 w-5 text-[#1D1D1F]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
              </svg>
            </div>
            <div>
              <p className="text-[16px] font-semibold text-[#1D1D1F]">Complete payment</p>
              <p className="text-[13px] text-[#86868B]">
                ${createdRide.estimatedFare.toFixed(2)} · {route?.distanceKm} km · {route?.durationMin} min
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#34C759]" />
              <span className="truncate text-[14px] text-[#1D1D1F]">{pickup?.address}</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#1D1D1F]" />
              <span className="truncate text-[14px] text-[#1D1D1F]">{dropoff?.address}</span>
            </div>
          </div>

          {paymentError && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-[#FFF5F5] px-4 py-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
              <p className="text-[13px] font-medium text-[#1D1D1F]">{paymentError}</p>
            </div>
          )}

          {stripe ? (
            <Elements
              stripe={stripe}
              options={{
                clientSecret: createdRide.clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#1D1D1F',
                    colorBackground: '#F5F5F7',
                    colorText: '#1D1D1F',
                    colorTextSecondary: '#6E6E73',
                    colorDanger: '#FF3B30',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    borderRadius: '12px',
                    spacingUnit: '4px',
                  },
                  rules: {
                    '.Input': { border: '1px solid #E8E8ED', boxShadow: 'none', padding: '12px 14px', fontSize: '15px' },
                    '.Input:focus': { border: '1px solid #1D1D1F', boxShadow: '0 0 0 1px #1D1D1F' },
                    '.Label': { fontSize: '13px', fontWeight: '500', color: '#6E6E73', marginBottom: '6px' },
                  },
                },
              }}
            >
              <InlinePaymentForm
                onSuccess={() => { setPaymentDone(true); setPaymentError(''); }}
                onError={(msg) => setPaymentError(msg)}
              />
            </Elements>
          ) : (
            <button
              onClick={() => setPaymentDone(true)}
              className="flex w-full items-center justify-center rounded-xl bg-[#1D1D1F] py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Booking form ───────────────────────────────────────────
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">

      {/* ── Map ──────────────────────────────────────────────── */}
      <div className="relative h-[280px] bg-[#F2F2F7] overflow-hidden">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={pickup || defaultCenter}
            zoom={12}
            onLoad={(map) => { mapRef.current = map; }}
            options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: false, clickableIcons: false }}
          >
            {pickup && (
              <Marker position={pickup} icon={{ url: pinSvg('#34C759'), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) }} />
            )}
            {dropoff && (
              <Marker position={dropoff} icon={{ url: pinSvg('#1D1D1F'), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) }} />
            )}
            {directions && (
              <DirectionsRenderer directions={directions} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#1D1D1F', strokeWeight: 4, strokeOpacity: 0.7 } }} />
            )}
          </GoogleMap>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {status === 'degraded' ? (
              <p className="text-[13px] text-[#86868B]">Enter locations below to see your route</p>
            ) : (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8E8ED] border-t-[#1D1D1F]" />
            )}
          </div>
        )}

        {hasRoute && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34C759] opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34C759]" />
            </span>
            <span className="text-[12px] font-semibold text-[#1D1D1F]">{route.durationMin} min ride</span>
          </div>
        )}

        {!pickup && !dropoff && !isLoaded && (
          <>
            <div className="absolute inset-0 opacity-[0.12]">
              {[20,40,60,80].map(p => <div key={`h${p}`} className="absolute h-[1px] w-full bg-[#86868B]" style={{ top: `${p}%` }} />)}
              {[25,50,75].map(p => <div key={`v${p}`} className="absolute h-full w-[1px] bg-[#86868B]" style={{ left: `${p}%` }} />)}
            </div>
            <div className="absolute right-0 bottom-0 h-[40%] w-[30%] rounded-tl-[60px] bg-[#D6E4F0] opacity-40" />
          </>
        )}
      </div>

      {/* ── Booking form ─────────────────────────────────────── */}
      <div className="p-5">
        {/* Error */}
        {bookingError && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-[#FFF5F5] px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
            <p className="text-[13px] font-medium text-[#1D1D1F]">{bookingError}</p>
          </div>
        )}

        {/* Location inputs */}
        <div className="space-y-2">
          {isLoaded ? (
            <>
              <Autocomplete
                onLoad={(ac) => { pickupAcRef.current = ac; }}
                onPlaceChanged={onPickupPlace}
                options={{ fields: ['formatted_address', 'geometry', 'place_id'] }}
              >
                <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#34C759]" />
                  <input
                    type="text"
                    placeholder="Pickup location"
                    value={pickupText}
                    onChange={(e) => setPickupText(e.target.value)}
                    className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
                  />
                </div>
              </Autocomplete>
              <Autocomplete
                onLoad={(ac) => { dropoffAcRef.current = ac; }}
                onPlaceChanged={onDropoffPlace}
                options={{ fields: ['formatted_address', 'geometry', 'place_id'] }}
              >
                <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1D1D1F]" />
                  <input
                    type="text"
                    placeholder="Where to?"
                    value={dropoffText}
                    onChange={(e) => setDropoffText(e.target.value)}
                    className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
                  />
                </div>
              </Autocomplete>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#34C759]" />
                <span className="text-[15px] font-medium text-[#A1A1A6]">Pickup location</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1D1D1F]" />
                <span className="text-[15px] font-medium text-[#A1A1A6]">Where to?</span>
              </div>
            </>
          )}
        </div>

        {/* Date/Time */}
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

        {/* Vehicle selector */}
        <div className="mt-4 flex gap-2">
          {(hasRoute ? quotes : [
            { vehicleClass: 'economy' as VehicleClass, tierName: 'Economy', fare: null },
            { vehicleClass: 'comfort' as VehicleClass, tierName: 'Comfort', fare: null },
            { vehicleClass: 'premium' as VehicleClass, tierName: 'Premium', fare: null },
          ]).map((q) => {
            const cls = q.vehicleClass;
            const active = selectedTier === cls;
            const fare = 'fare' in q && q.fare ? q.fare : null;
            return (
              <button
                key={cls}
                onClick={() => setSelectedTier(cls)}
                className={`flex-1 rounded-xl px-2 py-3 text-center transition-all duration-150 ${
                  active
                    ? 'bg-[#1D1D1F] text-white'
                    : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
                }`}
              >
                <p className="text-[16px] leading-none">{TIER_ICONS[cls]}</p>
                <p className={`mt-1.5 text-[12px] font-semibold ${active ? 'text-white' : 'text-[#1D1D1F]'}`}>
                  {'tierName' in q ? q.tierName : cls}
                </p>
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
              {quoteLoading ? (
                <span className="inline-block h-5 w-16 animate-pulse rounded bg-[#E8E8ED]" />
              ) : selectedQuote ? (
                `$${selectedQuote.fare.total.toFixed(2)}`
              ) : (
                '—'
              )}
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
          onClick={hasRoute ? confirmRide : undefined}
          disabled={!hasRoute || booking || quoteLoading}
          className={`mt-3 flex w-full items-center justify-center rounded-xl py-3.5 text-[15px] font-medium transition-colors duration-200 ${
            hasRoute && !booking
              ? 'bg-[#1D1D1F] text-white hover:bg-[#424245] cursor-pointer'
              : 'bg-[#E8E8ED] text-[#A1A1A6] cursor-default'
          }`}
        >
          {booking
            ? 'Booking...'
            : quoteLoading
              ? 'Calculating...'
              : hasRoute
                ? `Confirm ride · $${selectedQuote?.fare.total.toFixed(2)}`
                : 'Enter pickup & destination'
          }
        </button>
      </div>
    </div>
  );
}
