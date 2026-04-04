/**
 * Google Places Autocomplete — REST API (no SDK dependency).
 *
 * Uses the Places API (New) autocomplete endpoint which works
 * from any HTTP client, no native Google Maps SDK required.
 * Falls back to the legacy endpoint if New API isn't enabled.
 */

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export interface PlaceDetails {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * Search for place predictions using Google Places Autocomplete.
 * Biased to Seattle area for relevance.
 */
export async function searchPlaces(
  query: string,
  sessionToken?: string,
): Promise<PlacePrediction[]> {
  if (!API_KEY || query.length < 2) return [];

  const params = new URLSearchParams({
    input: query,
    key: API_KEY,
    // Bias to Seattle metro area
    location: '47.6062,-122.3321',
    radius: '50000',
    components: 'country:us',
  });

  if (sessionToken) params.set('sessiontoken', sessionToken);

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;

  console.log('[places] Searching:', query);

  const res = await fetch(url);
  if (!res.ok) {
    console.error('[places] HTTP error:', res.status);
    return [];
  }

  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('[places] API error:', data.status, data.error_message);
    return [];
  }

  const predictions: PlacePrediction[] = (data.predictions ?? []).map(
    (p: {
      place_id: string;
      structured_formatting: { main_text: string; secondary_text: string };
      description: string;
    }) => ({
      placeId: p.place_id,
      mainText: p.structured_formatting.main_text,
      secondaryText: p.structured_formatting.secondary_text,
      fullText: p.description,
    }),
  );

  console.log('[places] Found:', predictions.length, 'results');
  return predictions;
}

/**
 * Get place details (coordinates) by place_id.
 */
export async function getPlaceDetails(
  placeId: string,
  sessionToken?: string,
): Promise<PlaceDetails | null> {
  if (!API_KEY) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'geometry,formatted_address',
    key: API_KEY,
  });

  if (sessionToken) params.set('sessiontoken', sessionToken);

  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;

  console.log('[places] Getting details for:', placeId);

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 'OK' || !data.result) return null;

  const loc = data.result.geometry?.location;
  if (!loc) return null;

  const details: PlaceDetails = {
    placeId,
    address: data.result.formatted_address ?? '',
    lat: loc.lat,
    lng: loc.lng,
  };

  console.log('[places] Details:', details.address, `(${details.lat}, ${details.lng})`);
  return details;
}

/** Generate a unique session token for Places API billing optimization */
export function createSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
