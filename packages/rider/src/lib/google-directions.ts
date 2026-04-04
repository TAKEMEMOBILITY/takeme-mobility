/**
 * Google Directions API — REST client.
 *
 * Returns distance, duration, and encoded polyline for a route.
 * Used for fare calculation and map route drawing.
 */

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface RouteResult {
  distanceMeters: number;
  distanceKm: number;
  distanceMi: number;
  durationSeconds: number;
  durationMin: number;
  polyline: string;
  distanceText: string;
  durationText: string;
}

interface Coords {
  latitude: number;
  longitude: number;
}

/**
 * Calculate route between two coordinates using Google Directions API.
 * Returns null if the API call fails (caller should fall back to haversine).
 */
export async function getDirections(
  origin: Coords,
  destination: Coords,
): Promise<RouteResult | null> {
  if (!API_KEY) {
    console.warn('[directions] No API key — skipping Google Directions');
    return null;
  }

  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: 'driving',
    key: API_KEY,
  });

  const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;

  console.log('[directions] Requesting route:', {
    origin: `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}`,
    destination: `${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`,
  });

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[directions] HTTP error:', res.status);
      return null;
    }

    const data = await res.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      console.error('[directions] API error:', data.status, data.error_message);
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    const result: RouteResult = {
      distanceMeters: leg.distance.value,
      distanceKm: leg.distance.value / 1000,
      distanceMi: leg.distance.value / 1609.34,
      durationSeconds: leg.duration.value,
      durationMin: leg.duration.value / 60,
      polyline: route.overview_polyline.points,
      distanceText: leg.distance.text,
      durationText: leg.duration.text,
    };

    console.log('[directions] Route:', {
      distance: result.distanceText,
      duration: result.durationText,
      distanceMi: result.distanceMi.toFixed(2),
      durationMin: result.durationMin.toFixed(1),
    });

    return result;
  } catch (err) {
    console.error('[directions] Network error:', err);
    return null;
  }
}
