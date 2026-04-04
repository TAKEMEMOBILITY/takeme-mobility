'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/client';
import { withRetry } from '@/lib/utils';
import { Location, RideOption, Ride, Route, routeSchema, rideSchema } from '@/types';
import Map from '@/components/Map';
import LocationInput from '@/components/LocationInput';
import { GoogleMapsProvider } from '@/components/GoogleMapsProvider';
import { useTripEngine } from '@/lib/useTripEngine';
import PaymentModal from '@/components/PaymentModal';
import { useGeolocation, type GeoStatus } from '@/lib/useGeolocation';

type LocaleOption = {
  code: string;
  label: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY';
};

const localeOptions: LocaleOption[] = [
  { code: 'en-US', label: 'English (US)', currency: 'USD' },
  { code: 'en-GB', label: 'English (UK)', currency: 'GBP' },
  { code: 'de-DE', label: 'Deutsch', currency: 'EUR' },
  { code: 'fr-FR', label: 'Français', currency: 'EUR' },
  { code: 'ja-JP', label: '日本語', currency: 'JPY' },
  { code: 'es-ES', label: 'Español', currency: 'EUR' },
];

const RideStatusBadge: Record<Ride['status'], string> = {
  pending: 'bg-warning/15 text-ink',
  confirmed: 'bg-accent/10 text-accent',
  completed: 'bg-success/10 text-ink',
  cancelled: 'bg-surface-secondary text-ink-tertiary',
};

// ═══════════════════════════════════════════════════════════════════════════
// User-safe messages — NEVER expose technical errors
// ═══════════════════════════════════════════════════════════════════════════

const USER_MESSAGES = {
  // Location
  locationFallback: 'Using your approximate location. You can set a precise pickup below.',
  locationDenied: 'Location access is off. Set your pickup location manually.',

  // Route
  routeUnavailable: 'This route isn\'t available right now. Try a different destination.',

  // Booking
  selectBothLocations: 'Set your pickup and destination to continue.',
  selectValidRoute: 'We need a valid route to calculate your fare.',
  sessionExpired: 'Your session has ended. Signing you back in.',

  // General
  tryAgain: 'Something didn\'t work. Please try again.',
} as const;

// ── Location banner component ────────────────────────────────────────────

function LocationBanner({ geoStatus, onRequestPermission }: {
  geoStatus: GeoStatus;
  onRequestPermission: () => void;
}) {
  if (geoStatus === 'denied') {
    return (
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-surface-secondary px-4 py-3 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <svg className="h-4 w-4 shrink-0 text-ink-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
          </svg>
          <p className="text-[13px] text-ink-secondary">{USER_MESSAGES.locationDenied}</p>
        </div>
        <button
          onClick={onRequestPermission}
          className="shrink-0 text-[12px] font-semibold text-accent transition-opacity hover:opacity-70"
        >
          Enable
        </button>
      </div>
    );
  }

  if (geoStatus === 'unavailable') {
    return (
      <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-surface-secondary px-4 py-3 animate-fade-in">
        <svg className="h-4 w-4 shrink-0 text-ink-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
        </svg>
        <p className="text-[13px] text-ink-secondary">{USER_MESSAGES.locationFallback}</p>
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [stats, setStats] = useState({ totalRides: 0, totalSpent: 0, rating: 5.0 });
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [selectedRideType, setSelectedRideType] = useState<'economy' | 'comfort' | 'premium'>('economy');
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [userMessageType, setUserMessageType] = useState<'info' | 'warning'>('info');
  const [routeError, setRouteError] = useState('');
  const [locale, setLocale] = useState<LocaleOption>(localeOptions[0]);
  const [showPayment, setShowPayment] = useState(false);
  const [completedTripId, setCompletedTripId] = useState<string | null>(null);

  const { user, signOut: logOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { snapshot: tripSnapshot, setPickup: engineSetPickup, setDropoff: engineSetDropoff, startTrip: engineStartTrip } = useTripEngine();

  // ── Geolocation — production hook ──────────────────────────────────
  const { position: geoPosition, status: geoStatus, requestPermission } = useGeolocation();

  // Sync geolocation to pickup when position resolves
  useEffect(() => {
    if (!geoPosition) return;
    // Only auto-set if user hasn't manually entered a pickup
    if (pickupLocation) return;

    const location: Location = {
      lat: geoPosition.lat,
      lng: geoPosition.lng,
      address: geoPosition.address,
    };

    setPickupLocation(location);
    setPickup(location.address);
    engineSetPickup(location);
  }, [geoPosition, pickupLocation, engineSetPickup]);

  // Derive currentLocation for the map from geo hook
  const currentLocation = useMemo(() => {
    if (!geoPosition) return null;
    return { lat: geoPosition.lat, lng: geoPosition.lng, address: geoPosition.address };
  }, [geoPosition]);

  const rideTypes: RideOption[] = useMemo(
    () => [
      { id: 'economy', name: 'Economy', description: 'Reliable daily driver', estimatedPrice: 0, estimatedTime: 0, icon: '🚗' },
      { id: 'comfort', name: 'Comfort', description: 'More space and comfort', estimatedPrice: 0, estimatedTime: 0, icon: '🚙' },
      { id: 'premium', name: 'Premium', description: 'Luxury with professional service', estimatedPrice: 0, estimatedTime: 0, icon: '🚐' },
    ],
    []
  );

  const currencyFormatter = useMemo(() => new Intl.NumberFormat(locale.code, { style: 'currency', currency: locale.currency }), [locale]);
  const distanceFormatter = useMemo(() => new Intl.NumberFormat(locale.code, { maximumFractionDigits: 1 }), [locale]);

  const isValidCoordinate = useCallback((lat: number, lng: number): boolean => {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }, []);

  // ── Show user-safe message (auto-dismiss) ─────────────────────────
  const showMessage = useCallback((msg: string, type: 'info' | 'warning' = 'info', durationMs = 5000) => {
    setUserMessage(msg);
    setUserMessageType(type);
    if (durationMs > 0) {
      setTimeout(() => setUserMessage(''), durationMs);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await logOut();
      router.push('/auth/login');
    } catch {
      showMessage(USER_MESSAGES.tryAgain, 'warning');
    }
  }, [logOut, router, showMessage]);

  const fetchRides = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.from('rides').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) {
        console.warn('Could not fetch rides:', error.message);
        setRides([]);
        setStats({ totalRides: 0, totalSpent: 0, rating: 4.9 });
        return;
      }

      if (!data || data.length === 0) {
        setRides([]);
        setStats({ totalRides: 0, totalSpent: 0, rating: 4.9 });
        return;
      }

      const parsed = rideSchema.array().safeParse(data);
      if (!parsed.success) {
        console.warn('Ride data validation mismatch:', parsed.error.issues[0]?.message);
        setRides([]);
        setStats({ totalRides: data.length, totalSpent: 0, rating: 4.9 });
        return;
      }

      const safeRides = parsed.data;
      setRides(safeRides);

      const totalRides = safeRides.length;
      const totalSpent = safeRides.reduce((sum, ride) => sum + ride.estimated_fare, 0);
      setStats({ totalRides, totalSpent, rating: 4.9 });
    } catch (err) {
      console.warn('Failed to fetch rides:', err);
      setRides([]);
      setStats({ totalRides: 0, totalSpent: 0, rating: 4.9 });
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  const calculateDistanceAndPrice = useCallback(
    async (origin: Location, destination: Location) => {
      setUserMessage('');
      setRouteError('');
      if (!origin || !destination) {
        setDistance(null);
        setDuration(null);
        setEstimatedPrice(null);
        return;
      }

      if (!isValidCoordinate(origin.lat, origin.lng) || !isValidCoordinate(destination.lat, destination.lng)) {
        showMessage(USER_MESSAGES.selectBothLocations, 'info');
        setDistance(null);
        setDuration(null);
        setEstimatedPrice(null);
        return;
      }

      try {
        const getRouteResult = async (): Promise<google.maps.DirectionsResult> => {
          const directionsService = new google.maps.DirectionsService();
          return new Promise<google.maps.DirectionsResult>((resolve, reject) => {
            directionsService.route(
              {
                origin: new google.maps.LatLng(origin.lat, origin.lng),
                destination: new google.maps.LatLng(destination.lat, destination.lng),
                travelMode: google.maps.TravelMode.DRIVING,
              },
              (response, status) => {
                if (status === google.maps.DirectionsStatus.OK && response) {
                  resolve(response);
                } else {
                  reject(new Error(status));
                }
              }
            );
          });
        };

        const result = await withRetry(getRouteResult, 3, 500);
        const leg = result.routes?.[0]?.legs?.[0];
        if (!leg) throw new Error('No route data');

        const distanceKm = (leg.distance?.value ?? 0) / 1000;
        const distanceMi = distanceKm * 0.621371;
        const durationMin = Math.ceil((leg.duration?.value ?? 0) / 60);
        const polyline = result.routes?.[0]?.overview_polyline;

        if (distanceMi <= 0 || durationMin <= 0) {
          throw new Error('Invalid route metrics');
        }

        const routeData: Route = {
          distance: distanceMi,
          duration: durationMin,
          polyline: polyline || undefined,
        };

        routeSchema.parse(routeData);

        setDistance(distanceMi);
        setDuration(durationMin);

        const basePrices = { economy: 2.0, comfort: 3.0, premium: 4.0 };
        const perKmPrices = { economy: 1.5, comfort: 2.2, premium: 3.0 };

        const fare = basePrices[selectedRideType] + distanceMi * perKmPrices[selectedRideType];
        setEstimatedPrice(Number(fare.toFixed(2)));
      } catch (err) {
        console.error('Route calculation failed:', err);
        setRouteError(USER_MESSAGES.routeUnavailable);
        setDistance(null);
        setDuration(null);
        setEstimatedPrice(null);
      }
    },
    [isValidCoordinate, selectedRideType, showMessage]
  );

  const handlePickupSelect = useCallback(
    (place: google.maps.places.PlaceResult) => {
      if (!place.geometry?.location || !place.formatted_address) {
        showMessage(USER_MESSAGES.selectBothLocations, 'info');
        return;
      }
      const location: Location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        address: place.formatted_address,
      };
      setPickup(location.address);
      setPickupLocation(location);
      engineSetPickup(location);
      if (dropoffLocation) calculateDistanceAndPrice(location, dropoffLocation);
    },
    [calculateDistanceAndPrice, dropoffLocation, engineSetPickup, showMessage]
  );

  const handleDropoffSelect = useCallback(
    (place: google.maps.places.PlaceResult) => {
      if (!place.geometry?.location || !place.formatted_address) {
        showMessage(USER_MESSAGES.selectBothLocations, 'info');
        return;
      }
      const location: Location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        address: place.formatted_address,
      };
      setDropoff(location.address);
      setDropoffLocation(location);
      engineSetDropoff(location);
      if (pickupLocation) calculateDistanceAndPrice(pickupLocation, location);
    },
    [calculateDistanceAndPrice, pickupLocation, engineSetDropoff, showMessage]
  );

  // Ride data for payment modal
  const [pendingRide, setPendingRide] = useState<{ id: string; fare: number } | null>(null);

  const handleRequestRide = useCallback(async () => {
    if (!user) {
      showMessage(USER_MESSAGES.sessionExpired, 'warning');
      router.push('/auth/login');
      return;
    }

    if (!pickupLocation || !dropoffLocation) {
      showMessage(USER_MESSAGES.selectBothLocations, 'info');
      return;
    }

    if (distance === null || duration === null || estimatedPrice === null || distance <= 0) {
      showMessage(USER_MESSAGES.selectValidRoute, 'info');
      return;
    }

    setBookingLoading(true);
    setUserMessage('');

    try {
      // Create ride via API (also creates Stripe PaymentIntent)
      const res = await fetch('/api/rides/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: pickupLocation.address, pickupLat: pickupLocation.lat, pickupLng: pickupLocation.lng,
          dropoffAddress: dropoffLocation.address, dropoffLat: dropoffLocation.lat, dropoffLng: dropoffLocation.lng,
          distanceKm: distance / 0.621371, durationMin: duration,
          vehicleClass: selectedRideType,
          totalFare: estimatedPrice, currency: locale.currency,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) { router.push('/auth/login'); return; }
        const errData = await res.json();
        throw new Error(errData.error || 'Booking failed');
      }

      const data = await res.json();
      const rideId = data.ride?.id || data.id || 'unknown';

      // Show payment modal
      setPendingRide({ id: rideId, fare: estimatedPrice });
      setShowPayment(true);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : USER_MESSAGES.tryAgain, 'warning');
    } finally {
      setBookingLoading(false);
    }
  }, [user, pickupLocation, dropoffLocation, distance, duration, estimatedPrice, selectedRideType, locale, router, showMessage]);

  const handleCancelRide = useCallback(
    async (rideId: string) => {
      if (!rideId || !user) return;

      try {
        await withRetry(async () => {
          const { error } = await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId).eq('user_id', user.id);
          if (error) throw error;
        }, 3, 500);

        await fetchRides();
      } catch {
        showMessage(USER_MESSAGES.tryAgain, 'warning');
      }
    },
    [supabase, user, fetchRides, showMessage]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    fetchRides();
  }, [authLoading, user, fetchRides, router]);

  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      calculateDistanceAndPrice(pickupLocation, dropoffLocation);
    }
  }, [pickupLocation, dropoffLocation, calculateDistanceAndPrice]);

  // Trigger payment modal when trip completes
  useEffect(() => {
    const trip = tripSnapshot.trip;
    if (trip && trip.status === 'completed' && trip.id !== completedTripId && estimatedPrice && estimatedPrice > 0) {
      setCompletedTripId(trip.id);
      setShowPayment(true);
    }
  }, [tripSnapshot.trip, completedTripId, estimatedPrice]);

  const handlePaymentComplete = useCallback(() => {
    setShowPayment(false);
    setPendingRide(null);
    setBookingSuccess(true);
    setConfirmationMessage('Payment confirmed. Your driver is on the way!');

    // NOW start the trip simulation after payment succeeds
    if (pickupLocation && dropoffLocation) {
      engineStartTrip(pickupLocation, dropoffLocation);
    }

    setTimeout(() => setBookingSuccess(false), 4500);
    fetchRides();
  }, [pickupLocation, dropoffLocation, engineStartTrip, fetchRides]);

  const handlePaymentDismiss = useCallback(() => {
    setShowPayment(false);
  }, []);

  // ── Derived: active trip check (only genuine, non-stale trips) ──────
  const tripActive = tripSnapshot.trip
    && tripSnapshot.trip.status !== 'idle'
    && tripSnapshot.trip.status !== 'completed'
    && tripSnapshot.trip.id.startsWith('trip-'); // Only engine-created trips, not DB ghosts

  // ── Derived: per-tier price preview ───────────────────────────────
  const tierPrices = useMemo(() => {
    if (distance === null || distance <= 0) return null;
    const base = { economy: 2.0, comfort: 3.0, premium: 4.0 };
    const perKm = { economy: 1.5, comfort: 2.2, premium: 3.0 };
    return {
      economy: Number((base.economy + distance * perKm.economy).toFixed(2)),
      comfort: Number((base.comfort + distance * perKm.comfort).toFixed(2)),
      premium: Number((base.premium + distance * perKm.premium).toFixed(2)),
    };
  }, [distance]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-ink" />
        </div>
      </div>
    );
  }

  return (
    <GoogleMapsProvider>
    <div className="min-h-screen bg-background text-ink">
      {/* ── Nav — matches main site ────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#d2d2d7] bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 lg:px-10">
          {/* Logo */}
          <a href="/" className="shrink-0 text-[17px] tracking-[0.01em] text-[#1d1d1f]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[4px] font-light text-[#86868b]">Mobility</span>
          </a>

          {/* Center links */}
          <div className="hidden items-center gap-6 lg:flex">
            {[
              { label: 'TakeMe Fleet', href: '/fleet' },
              { label: 'Business', href: '/business' },
              { label: 'TakeMe Connect', href: '/connect' },
              { label: 'Students Membership', href: '/students' },
              { label: 'Driver Hub', href: '/driver-hub' },
            ].map(({ label, href }) => (
              <a key={href} href={href} className="whitespace-nowrap text-[13px] font-medium text-[#86868b] transition-colors duration-200 hover:text-[#1d1d1f]">
                {label}
              </a>
            ))}
          </div>

          {/* Right — user actions */}
          <div className="flex shrink-0 items-center gap-3">
            <select
              aria-label="Locale"
              value={locale.code}
              onChange={(event) => {
                const selected = localeOptions.find((opt) => opt.code === event.target.value);
                if (selected) setLocale(selected);
              }}
              className="hidden rounded-lg border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#6e6e73] outline-none sm:block"
            >
              {localeOptions.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
            <button
              onClick={handleSignOut}
              className="text-[13px] font-medium text-[#86868b] transition-colors hover:text-[#1d1d1f]"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Success toast ──────────────────────────────────────────────── */}
      {bookingSuccess && (
        <div className="mx-auto mt-3 w-full max-w-7xl px-5 md:px-8 animate-fade-in">
          <div className="flex items-center gap-3 rounded-2xl bg-success/10 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-success" />
            <p className="text-sm font-medium text-ink">{confirmationMessage || 'Ride booked successfully.'}</p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1280px] px-6 pb-16 lg:px-10">
        {/* ── Two-column layout: booking panel + map ───────────────────── */}
        <section className="mt-4 grid gap-6 overflow-hidden lg:grid-cols-[440px_minmax(0,1fr)]">

          {/* ── LEFT: Booking panel ─────────────────────────────────────── */}
          <div className="order-2 lg:order-1">
            <div className="rounded-2xl border border-[#d2d2d7] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

              {/* User-safe messages */}
              {userMessage && (
                <div className={`mb-4 flex items-start gap-2.5 rounded-xl px-4 py-3 animate-fade-in ${
                  userMessageType === 'warning' ? 'bg-[#fff8e1]' : 'bg-[#f5f5f7]'
                }`}>
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    userMessageType === 'warning' ? 'bg-[#ff9f0a]' : 'bg-[#86868b]'
                  }`} />
                  <p className="text-sm font-medium text-[#1d1d1f]">{userMessage}</p>
                </div>
              )}

              {routeError && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-[#f5f5f7] px-4 py-3 animate-fade-in">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#86868b]" />
                  <p className="text-sm font-medium text-[#6e6e73]">{routeError}</p>
                </div>
              )}

              {/* Trip active state */}
              {tripActive ? (
                <div className="animate-fade-in">
                  {(() => {
                    const phase = tripSnapshot.trip!.status;
                    const eta = tripSnapshot.trip!.eta;
                    const cfg: Record<string, { color: string; label: string; sub: string }> = {
                      searching: { color: 'bg-[#86868b]', label: 'Finding your driver',       sub: 'This usually takes a moment' },
                      assigned:  { color: 'bg-[#1D6AE5]', label: 'Driver assigned',            sub: 'Preparing for pickup' },
                      arriving:  { color: 'bg-[#1D6AE5]', label: `Arriving in ${eta} min`,     sub: 'Your driver is on the way' },
                      arrived:   { color: 'bg-[#34c759]', label: 'Driver has arrived',         sub: 'Head to the pickup point' },
                      on_trip:   { color: 'bg-[#1D6AE5]', label: `${eta} min remaining`,       sub: 'Enjoy your ride' },
                    };
                    const s = cfg[phase] ?? cfg.arriving;
                    return (
                      <div className="flex items-center gap-4 py-1">
                        <div className="relative flex h-10 w-10 items-center justify-center">
                          <span className={`h-3 w-3 rounded-full ${s.color}`} />
                          {(phase === 'arriving' || phase === 'on_trip' || phase === 'searching') && (
                            <span className={`absolute inset-0 rounded-full ${s.color} animate-ping opacity-20`} />
                          )}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-[#1d1d1f] tabular-nums">{s.label}</p>
                          <p className="text-xs text-[#86868b]">{s.sub}</p>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-4 flex items-baseline justify-between rounded-xl bg-[#f5f5f7] px-4 py-3">
                    <div className="flex items-baseline gap-4">
                      <span className="text-xs text-[#86868b]">{distance !== null ? `${distanceFormatter.format(distance)} mi` : ''}</span>
                      <span className="text-xs text-[#86868b]">{duration !== null ? `${duration} min` : ''}</span>
                    </div>
                    <span className="text-base font-bold tabular-nums text-[#1d1d1f]">{estimatedPrice !== null ? currencyFormatter.format(estimatedPrice) : ''}</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Booking mode */}
                  <h2 className="mb-4 text-[20px] font-semibold text-[#1d1d1f]">Where to?</h2>

                  <LocationBanner geoStatus={geoStatus} onRequestPermission={requestPermission} />

                  {/* Location inputs */}
                  <div className="space-y-2">
                    <LocationInput placeholder="Pickup location" value={pickup} onChange={setPickup} onPlaceSelect={handlePickupSelect} icon="pickup" />
                    <LocationInput placeholder="Where to?" value={dropoff} onChange={setDropoff} onPlaceSelect={handleDropoffSelect} icon="dropoff" />
                  </div>

                  {/* Ride type selector */}
                  <p className="mt-5 mb-2 text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Vehicle</p>
                  <div className="flex gap-2">
                    {rideTypes.map((rideType) => {
                      const isSelected = selectedRideType === rideType.id;
                      const tierPrice = tierPrices?.[rideType.id];
                      return (
                        <button
                          key={rideType.id}
                          type="button"
                          onClick={() => {
                            setSelectedRideType(rideType.id);
                            if (pickupLocation && dropoffLocation) {
                              calculateDistanceAndPrice(pickupLocation, dropoffLocation);
                            }
                          }}
                          className={`flex-1 rounded-xl px-3 py-3 text-center transition-all duration-150 ${
                            isSelected
                              ? 'bg-[#1D6AE5] text-white shadow-lg shadow-[#1D6AE5]/20'
                              : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]'
                          }`}
                        >
                          <p className="text-lg leading-none">{rideType.icon}</p>
                          <p className={`mt-1.5 text-xs font-semibold ${isSelected ? 'text-white' : 'text-[#1d1d1f]'}`}>{rideType.name}</p>
                          {tierPrice && (
                            <p className={`mt-0.5 text-[11px] tabular-nums ${isSelected ? 'text-white/70' : 'text-[#86868b]'}`}>
                              {currencyFormatter.format(tierPrice)}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Trip details */}
                  <div className="mt-5 grid grid-cols-3 gap-4 rounded-xl bg-[#f5f5f7] p-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Distance</p>
                      <p className="mt-1 text-base font-semibold tabular-nums text-[#1d1d1f]">{distance !== null ? `${distanceFormatter.format(distance)} mi` : '--'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Duration</p>
                      <p className="mt-1 text-base font-semibold tabular-nums text-[#1d1d1f]">{duration !== null ? `${duration} min` : '--'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Fare</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-[#1d1d1f]">{estimatedPrice !== null ? currencyFormatter.format(estimatedPrice) : '--'}</p>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={handleRequestRide}
                    disabled={bookingLoading || !pickupLocation || !dropoffLocation || !distance || !estimatedPrice}
                    className="mt-5 w-full rounded-xl bg-[#1D6AE5] py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-[#1558C0] active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
                  >
                    {bookingLoading ? 'Booking...' : estimatedPrice ? `Confirm ride · ${currencyFormatter.format(estimatedPrice)}` : 'Confirm ride'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── RIGHT: Map ──────────────────────────────────────────────── */}
          <div className="order-1 h-[50vh] w-full min-w-0 overflow-hidden rounded-2xl border border-[#d2d2d7] lg:order-2 lg:h-[75vh] lg:sticky lg:top-[80px]">
          <Map
            currentLocation={currentLocation || undefined}
            pickupLocation={pickupLocation || undefined}
            dropoffLocation={dropoffLocation || undefined}
            onRouteError={(message) => setRouteError(message)}
            tripSnapshot={tripSnapshot}
          />
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { label: 'Rides', value: String(stats.totalRides), icon: '↗' },
            { label: 'Spend', value: currencyFormatter.format(stats.totalSpent), icon: '◆' },
            { label: 'Rating', value: `${stats.rating.toFixed(1)}`, icon: '★' },
          ].map((stat) => (
            <article key={stat.label} className="rounded-xl border border-[#d2d2d7] bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">{stat.label}</p>
                <span className="text-[#86868b] text-xs">{stat.icon}</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#1d1d1f]">{stat.value}</p>
            </article>
          ))}
        </section>

        {/* ── Ride history ─────────────────────────────────────────────── */}
        <section className="mt-6 rounded-xl border border-[#d2d2d7] bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#1d1d1f]">Recent Rides</h3>
            {rides.length > 0 && (
              <span className="text-xs text-ink-tertiary">{rides.length} ride{rides.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {rides.length === 0 ? (
            <div className="mt-8 mb-4 text-center">
              <p className="text-sm text-ink-secondary">No rides yet</p>
              <p className="mt-1 text-xs text-ink-tertiary">Your ride history will appear here.</p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-border/40">
              {rides.map((ride) => (
                <article key={ride.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                      <p className="truncate text-sm font-medium text-ink">{ride.pickup_location.address}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                      <p className="truncate text-xs text-ink-tertiary">{ride.dropoff_location.address}</p>
                    </div>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-ink">{currencyFormatter.format(ride.estimated_fare)}</p>
                      <p className="text-[11px] text-ink-tertiary">
                        {ride.created_at ? new Date(ride.created_at).toLocaleDateString(locale.code, { month: 'short', day: 'numeric' }) : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${RideStatusBadge[ride.status]}`}>{ride.status}</span>
                    {ride.status === 'pending' && (
                      <button
                        onClick={() => handleCancelRide(ride.id!)}
                        className="text-xs font-medium text-danger transition-colors hover:text-danger/70"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>

    {/* Payment modal — shown after ride creation, before trip starts */}
    {showPayment && pendingRide && (
      <PaymentModal
        trip={{
          tripId: pendingRide.id,
          distance: distance ?? 0,
          duration: duration ?? 0,
          fare: pendingRide.fare,
          currency: locale.currency.toLowerCase(),
        }}
        onComplete={handlePaymentComplete}
        onDismiss={handlePaymentDismiss}
        formatCurrency={(amount) => currencyFormatter.format(amount)}
        formatDistance={(mi) => `${distanceFormatter.format(mi)} mi`}
      />
    )}
    </GoogleMapsProvider>
  );
}
