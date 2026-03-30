// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — Route Service (Server-side)
// Calculates route distance/duration via Google Directions API.
// Used by the quote endpoint. Runs server-side only (uses secret key).
// ═══════════════════════════════════════════════════════════════════════════

import { TTLCache } from '@/lib/cache';

// Cache routes for 15 min, geocoding for 1 hour
const routeCache = new TTLCache<RouteResult>(500, 15 * 60 * 1000);
const geocodeCache = new TTLCache<{ lat: number; lng: number; formattedAddress: string }>(1000, 60 * 60 * 1000);

// Round coordinates to ~100m grid for cache key (3 decimal places)
function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

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

  // Check cache (rounded to ~100m grid)
  const cacheKey = `${roundCoord(input.pickupLat)},${roundCoord(input.pickupLng)}-${roundCoord(input.dropoffLat)},${roundCoord(input.dropoffLng)}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

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

  const result: RouteResult = {
    distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
    durationMin: Math.ceil(leg.duration.value / 60),
    polyline: route.overview_polyline?.points ?? '',
    pickupAddress: leg.start_address ?? '',
    dropoffAddress: leg.end_address ?? '',
  };

  routeCache.set(cacheKey, result);
  return result;
}

/**
 * Geocode an address string to lat/lng.
 * Used when the client sends address text instead of coordinates.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formattedAddress: string }> {
  if (!GOOGLE_MAPS_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  // Check cache
  const cacheKey = address.trim().toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

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

  const geoResult = data.results[0];
  const geocoded = {
    lat: geoResult.geometry.location.lat,
    lng: geoResult.geometry.location.lng,
    formattedAddress: geoResult.formatted_address,
  };

  geocodeCache.set(cacheKey, geocoded);
  return geocoded;
}
