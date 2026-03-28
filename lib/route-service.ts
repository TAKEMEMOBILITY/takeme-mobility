// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — Route Service (Server-side)
// Calculates route distance/duration via Google Directions API.
// Used by the quote endpoint. Runs server-side only (uses secret key).
// ═══════════════════════════════════════════════════════════════════════════

export interface RouteInput {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  polyline: string;
  pickupAddress: string;
  dropoffAddress: string;
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/**
 * Resolve route via Google Directions API (server-side fetch).
 * Returns distance in km, duration in minutes, and encoded polyline.
 */
export async function calculateRoute(input: RouteInput): Promise<RouteResult> {
  if (!GOOGLE_MAPS_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  const origin = `${input.pickupLat},${input.pickupLng}`;
  const destination = `${input.dropoffLat},${input.dropoffLng}`;

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('key', GOOGLE_MAPS_KEY);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Google Directions API error: ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== 'OK' || !data.routes?.length) {
    throw new Error(`No route found: ${data.status}`);
  }

  const route = data.routes[0];
  const leg = route.legs[0];

  if (!leg?.distance?.value || !leg?.duration?.value) {
    throw new Error('Route returned invalid distance/duration');
  }

  return {
    distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
    durationMin: Math.ceil(leg.duration.value / 60),
    polyline: route.overview_polyline?.points ?? '',
    pickupAddress: leg.start_address ?? '',
    dropoffAddress: leg.end_address ?? '',
  };
}

/**
 * Geocode an address string to lat/lng.
 * Used when the client sends address text instead of coordinates.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formattedAddress: string }> {
  if (!GOOGLE_MAPS_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('key', GOOGLE_MAPS_KEY);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Google Geocoding API error: ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}
