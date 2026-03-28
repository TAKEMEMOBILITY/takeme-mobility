'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/client';
import { fetchWithRetry, withRetry } from '@/lib/utils';
import { Location, RideOption, Ride, Route, locationSchema, routeSchema, rideSchema } from '@/types';
import Map from '@/components/Map';
import LocationInput from '@/components/LocationInput';
import { GoogleMapsProvider } from '@/components/GoogleMapsProvider';
import { useTripEngine } from '@/lib/useTripEngine';
import PaymentModal from '@/components/PaymentModal';

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

export default function DashboardPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [stats, setStats] = useState({ totalRides: 0, totalSpent: 0, rating: 5.0 });
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
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
  const [errorMessage, setErrorMessage] = useState('');
  const [routeError, setRouteError] = useState('');
  const [locale, setLocale] = useState<LocaleOption>(localeOptions[0]);
  const [showPayment, setShowPayment] = useState(false);
  const [completedTripId, setCompletedTripId] = useState<string | null>(null);

  const { user, signOut: logOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { snapshot: tripSnapshot, setPickup: engineSetPickup, setDropoff: engineSetDropoff } = useTripEngine();

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

  const handleSignOut = useCallback(async () => {
    try {
      await logOut();
      router.push('/auth/login');
    } catch (error) {
      setErrorMessage('Unable to sign out at this time. Please try again.');
      console.error('Sign out failed:', error);
    }
  }, [logOut, router]);

  const fetchRides = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.from('ride_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) {
        // Table may not exist yet — not a fatal error
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
        console.warn('Ride data validation mismatch (showing raw count):', parsed.error.issues[0]?.message);
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

  const getCurrentLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMessage('Geolocation not supported; using default location.');
      const defaultLocation: Location = { lat: 40.7128, lng: -74.0060, address: 'New York, NY' };
      setCurrentLocation(defaultLocation);
      setPickupLocation(defaultLocation);
      engineSetPickup(defaultLocation);
      setPickup(defaultLocation.address);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        if (!isValidCoordinate(latitude, longitude)) {
          setErrorMessage('Invalid coordinates received from device; using fallback location.');
          const defaultLocation: Location = { lat: 40.7128, lng: -74.0060, address: 'New York, NY' };
          setCurrentLocation(defaultLocation);
          setPickupLocation(defaultLocation);
          engineSetPickup(defaultLocation);
          setPickup(defaultLocation.address);
          return;
        }

        setErrorMessage('');
        const fallbackLatLng = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;

        try {
          const response = await fetchWithRetry(geocodeUrl, undefined, 10000, 3);
          const geoData = await response.json();
          const geoSchema = z.object({
            results: z.array(z.object({ formatted_address: z.string().optional()})).optional(),
          });

          const parsedGeo = geoSchema.safeParse(geoData);
          const address = parsedGeo.success ? parsedGeo.data.results?.[0]?.formatted_address || fallbackLatLng : fallbackLatLng;

          const location: Location = { lat: latitude, lng: longitude, address };

          const locationValidation = locationSchema.safeParse(location);
          if (!locationValidation.success) {
            throw new Error(`Invalid location data from geocode: ${locationValidation.error.message}`);
          }

          setCurrentLocation(location);
          setPickup(location.address);
          setPickupLocation(location);
          engineSetPickup(location);
        } catch (err) {
          console.error('Geolocation reverse geocode failed:', err);
          setErrorMessage('Could not reverse geocode location; using raw coordinates.');
          const location: Location = { lat: latitude, lng: longitude, address: fallbackLatLng };
          setCurrentLocation(location);
          setPickup(location.address);
          setPickupLocation(location);
          engineSetPickup(location);
        }
      },
      (error) => {
        console.error('Geolocation failed:', error);
        setErrorMessage('Permission denied for GPS; defaulting to New York');
        const defaultLocation: Location = { lat: 40.7128, lng: -74.0060, address: 'New York, NY' };
        setCurrentLocation(defaultLocation);
        setPickup(defaultLocation.address);
        setPickupLocation(defaultLocation);
        engineSetPickup(defaultLocation);
      },
      { enableHighAccuracy: true, maximumAge: 600000, timeout: 10000 }
    );
  }, [isValidCoordinate, engineSetPickup]);

  const calculateDistanceAndPrice = useCallback(
    async (origin: Location, destination: Location) => {
      setErrorMessage('');
      setRouteError('');
      if (!origin || !destination) {
        setDistance(null);
        setDuration(null);
        setEstimatedPrice(null);
        return;
      }

      if (!isValidCoordinate(origin.lat, origin.lng) || !isValidCoordinate(destination.lat, destination.lng)) {
        setErrorMessage('Invalid pickup or dropoff coordinates.');
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
                  reject(new Error(`Directions request failed: ${status}`));
                }
              }
            );
          });
        };

        const result = await withRetry(getRouteResult, 3, 500);
        const leg = result.routes?.[0]?.legs?.[0];
        if (!leg) throw new Error('No route data from Google');

        const distanceKm = (leg.distance?.value ?? 0) / 1000;
        const durationMin = Math.ceil((leg.duration?.value ?? 0) / 60);
        const polyline = result.routes?.[0]?.overview_polyline;

        if (distanceKm <= 0 || durationMin <= 0) {
          throw new Error('Route result invalid: zero distance or duration');
        }

        const routeData: Route = {
          distance: distanceKm,
          duration: durationMin,
          polyline: polyline || undefined,
        };

        routeSchema.parse(routeData);

        setDistance(distanceKm);
        setDuration(durationMin);

        const basePrices = { economy: 2.0, comfort: 3.0, premium: 4.0 };
        const perKmPrices = { economy: 1.5, comfort: 2.2, premium: 3.0 };

        const fare = basePrices[selectedRideType] + distanceKm * perKmPrices[selectedRideType];
        setEstimatedPrice(Number(fare.toFixed(2)));
      } catch (err) {
        setRouteError('Route check failed. Please try a different route or continue with pickup/dropoff manual entry.');
        setErrorMessage('Could not calculate route. Please choose other locations or try again.');
        setDistance(null);
        setDuration(null);
        setEstimatedPrice(null);
        console.error('Error calculating distance:', err);
      }
    },    [isValidCoordinate, selectedRideType]
  );

  const handlePickupSelect = useCallback(
    (place: google.maps.places.PlaceResult) => {
      if (!place.geometry?.location || !place.formatted_address) {
        setErrorMessage('Invalid pickup place.');
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
    [calculateDistanceAndPrice, dropoffLocation, engineSetPickup]
  );

  const handleDropoffSelect = useCallback(
    (place: google.maps.places.PlaceResult) => {
      if (!place.geometry?.location || !place.formatted_address) {
        setErrorMessage('Invalid dropoff place.');
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
    [calculateDistanceAndPrice, pickupLocation, engineSetDropoff]
  );

  const handleRequestRide = useCallback(async () => {
    if (!user) {
      setErrorMessage('User session expired. Please log in again.');
      router.push('/auth/login');
      return;
    }

    if (!pickupLocation || !dropoffLocation) {
      setErrorMessage('Please select both pickup and destination.');
      return;
    }

    if (distance === null || duration === null || estimatedPrice === null || distance <= 0) {
      setErrorMessage('Please select a valid route before booking.');
      return;
    }

    setBookingLoading(true);
    setErrorMessage('');

    // 1. Start the trip simulation immediately — this is the user-facing action
    //    The engine already has pickup/dropoff from location selection.
    //    Show confirmation so the user sees the trip is live.
    setBookingSuccess(true);
    setConfirmationMessage(`Ride booked: ${distanceFormatter.format(distance)} km, ${duration} min, ${currencyFormatter.format(estimatedPrice)}`);
    setTimeout(() => setBookingSuccess(false), 4500);
    setBookingLoading(false);

    // 2. Persist to database in the background — non-blocking
    //    If Supabase is down or the table doesn't exist, the trip still runs.
    try {
      await supabase.from('ride_requests').insert({
        user_id: user.id,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        ride_type: selectedRideType,
        estimated_fare: estimatedPrice,
        estimated_time: duration,
        status: 'pending',
      });
    } catch (err) {
      // DB write failed — log but don't block the trip
      console.warn('Background DB write failed (trip still running):', err);
    }
  }, [user, pickupLocation, dropoffLocation, distance, duration, estimatedPrice, selectedRideType, router, distanceFormatter, currencyFormatter, supabase]);

  const handleCancelRide = useCallback(
    async (rideId: string) => {
      if (!rideId || !user) {
        setErrorMessage('Invalid cancel request.');
        return;
      }

      try {
        await withRetry(async () => {
          const { error } = await supabase.from('ride_requests').update({ status: 'cancelled' }).eq('id', rideId).eq('user_id', user.id);
          if (error) throw error;
        }, 3, 500);

        await fetchRides();
      } catch (err) {
        setErrorMessage('Unable to cancel ride.');
        console.error('Error cancelling ride:', err);
      }
    },
    [supabase, user, fetchRides]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    fetchRides();
    getCurrentLocation();
  }, [authLoading, user, fetchRides, getCurrentLocation, router]);

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
    setBookingSuccess(true);
    setConfirmationMessage('Payment confirmed. Thank you for riding with us!');
    setPickup('');
    setDropoff('');
    setPickupLocation(null);
    setDropoffLocation(null);
    engineSetPickup(null);
    engineSetDropoff(null);
    setDistance(null);
    setDuration(null);
    setEstimatedPrice(null);
    fetchRides();
    setTimeout(() => setBookingSuccess(false), 4500);
  }, [engineSetPickup, engineSetDropoff, fetchRides]);

  const handlePaymentDismiss = useCallback(() => {
    setShowPayment(false);
  }, []);

  // ── Derived: active trip check ──────────────────────────────────────
  const tripActive = tripSnapshot.trip && tripSnapshot.trip.status !== 'idle' && tripSnapshot.trip.status !== 'completed';

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
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3 md:px-8">
          <span className="text-[22px] font-bold tracking-tight text-ink">Ride</span>
          <div className="flex items-center gap-2">
            <select
              aria-label="Locale"
              value={locale.code}
              onChange={(event) => {
                const selected = localeOptions.find((opt) => opt.code === event.target.value);
                if (selected) setLocale(selected);
              }}
              className="rounded-lg bg-surface-secondary px-3 py-2 text-xs font-medium text-ink-secondary outline-none transition-colors hover:bg-surface-tertiary"
            >
              {localeOptions.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
            <button
              onClick={handleSignOut}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-tertiary transition-colors hover:bg-surface-secondary hover:text-ink"
            >
              Sign Out
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

      <main className="mx-auto max-w-7xl px-5 pb-16 md:px-8">
        {/* ── Map ───────────────────────────────────────────────────────── */}
        <section className="relative mt-4 h-[72vh] md:h-[80vh] overflow-hidden rounded-2xl">
          <Map
            currentLocation={currentLocation || undefined}
            pickupLocation={pickupLocation || undefined}
            dropoffLocation={dropoffLocation || undefined}
            onRouteError={(message) => setRouteError(message)}
            tripSnapshot={tripSnapshot}
          />

          {/* ── Booking panel ───────────────────────────────────────────── */}
          <aside className="absolute inset-x-4 bottom-4 z-20 mx-auto w-auto max-w-lg rounded-2xl border border-white/20 bg-white/85 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:inset-x-6 animate-fade-in">

            {/* Errors */}
            {errorMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-danger/8 px-4 py-3 animate-fade-in">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-danger" />
                <p className="text-sm font-medium text-ink">{errorMessage}</p>
              </div>
            )}
            {routeError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-warning/10 px-4 py-3 animate-fade-in">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-warning" />
                <p className="text-sm font-medium text-ink">{routeError}</p>
              </div>
            )}

            {/* ── Trip active state ── replaces booking UI with trip focus ── */}
            {tripActive ? (
              <div className="animate-fade-in">
                {(() => {
                  const phase = tripSnapshot.trip!.status;
                  const eta = tripSnapshot.trip!.eta;
                  const cfg: Record<string, { color: string; label: string; sub: string }> = {
                    searching: { color: 'bg-ink-tertiary', label: 'Finding your driver',       sub: 'This usually takes a moment' },
                    assigned:  { color: 'bg-accent',       label: 'Driver assigned',            sub: 'Preparing for pickup' },
                    arriving:  { color: 'bg-accent',       label: `Arriving in ${eta} min`,     sub: 'Your driver is on the way' },
                    arrived:   { color: 'bg-success',      label: 'Driver has arrived',         sub: 'Head to the pickup point' },
                    on_trip:   { color: 'bg-accent',       label: `${eta} min remaining`,       sub: 'Enjoy your ride' },
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
                        <p className="text-base font-semibold text-ink tabular-nums">{s.label}</p>
                        <p className="text-xs text-ink-tertiary">{s.sub}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Mini fare display during trip */}
                <div className="mt-4 flex items-baseline justify-between rounded-xl bg-surface-secondary px-4 py-3">
                  <div className="flex items-baseline gap-4">
                    <span className="text-xs text-ink-tertiary">{distance !== null ? `${distanceFormatter.format(distance)} km` : ''}</span>
                    <span className="text-xs text-ink-tertiary">{duration !== null ? `${duration} min` : ''}</span>
                  </div>
                  <span className="text-base font-bold tabular-nums text-ink">{estimatedPrice !== null ? currencyFormatter.format(estimatedPrice) : ''}</span>
                </div>
              </div>
            ) : (
              <>
                {/* ── Booking mode ─────────────────────────────────────────── */}

                {/* Location inputs */}
                <div className="space-y-2">
                  <LocationInput placeholder="Pickup location" value={pickup} onChange={setPickup} onPlaceSelect={handlePickupSelect} icon="pickup" />
                  <LocationInput placeholder="Where to?" value={dropoff} onChange={setDropoff} onPlaceSelect={handleDropoffSelect} icon="dropoff" />
                </div>

                {/* Ride type selector — with live price per tier */}
                <div className="mt-4 flex gap-2">
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
                            ? 'bg-ink text-white shadow-lg shadow-ink/20'
                            : 'bg-surface-secondary text-ink hover:bg-surface-tertiary'
                        }`}
                      >
                        <p className="text-lg leading-none">{rideType.icon}</p>
                        <p className={`mt-1.5 text-xs font-semibold ${isSelected ? 'text-white' : 'text-ink'}`}>{rideType.name}</p>
                        {tierPrice && (
                          <p className={`mt-0.5 text-[11px] tabular-nums ${isSelected ? 'text-white/70' : 'text-ink-tertiary'}`}>
                            {currencyFormatter.format(tierPrice)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Trip details */}
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">Distance</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-ink">{distance !== null ? `${distanceFormatter.format(distance)} km` : '--'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">Duration</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-ink">{duration !== null ? `${duration} min` : '--'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">Fare</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-ink">{estimatedPrice !== null ? currencyFormatter.format(estimatedPrice) : '--'}</p>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={handleRequestRide}
                  disabled={bookingLoading || !pickupLocation || !dropoffLocation || !distance || !estimatedPrice}
                  className="mt-4 w-full rounded-xl bg-ink py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
                >
                  {bookingLoading ? 'Booking...' : estimatedPrice ? `Book Ride \u00B7 ${currencyFormatter.format(estimatedPrice)}` : 'Book Ride'}
                </button>
              </>
            )}
          </aside>
        </section>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { label: 'Rides', value: String(stats.totalRides), icon: '↗' },
            { label: 'Spend', value: currencyFormatter.format(stats.totalSpent), icon: '◆' },
            { label: 'Rating', value: `${stats.rating.toFixed(1)}`, icon: '★' },
          ].map((stat) => (
            <article key={stat.label} className="rounded-2xl bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">{stat.label}</p>
                <span className="text-ink-tertiary text-xs">{stat.icon}</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{stat.value}</p>
            </article>
          ))}
        </section>

        {/* ── Ride history ─────────────────────────────────────────────── */}
        <section className="mt-6 rounded-2xl bg-surface p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">Recent Rides</h3>
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

    {/* Post-trip payment modal */}
    {showPayment && estimatedPrice && tripSnapshot.trip && (
      <PaymentModal
        trip={{
          tripId: tripSnapshot.trip.id,
          distance: distance ?? 0,
          duration: duration ?? 0,
          fare: estimatedPrice,
          currency: locale.currency.toLowerCase(),
        }}
        onComplete={handlePaymentComplete}
        onDismiss={handlePaymentDismiss}
        formatCurrency={(amount) => currencyFormatter.format(amount)}
        formatDistance={(km) => distanceFormatter.format(km)}
      />
    )}
    </GoogleMapsProvider>
  );
}
