'use client';

// ═══════════════════════════════════════════════════════════════════════════
// useDirections — calculates route between two points using Google
// Directions Service. Only runs when google.maps is fully loaded.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  distanceText: string;
  durationText: string;
}

export function useDirections(
  origin: { lat: number; lng: number } | null,
  destination: { lat: number; lng: number } | null,
  mapsReady: boolean,
) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!origin || !destination || !mapsReady) {
      setRoute(null);
      return;
    }

    if (typeof google === 'undefined' || !google.maps?.DirectionsService) return;

    setLoading(true);
    setError('');

    try {
      const svc = new google.maps.DirectionsService();
      svc.route(
        {
          origin: new google.maps.LatLng(origin.lat, origin.lng),
          destination: new google.maps.LatLng(destination.lat, destination.lng),
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          setLoading(false);
          if (status === google.maps.DirectionsStatus.OK && result) {
            const leg = result.routes?.[0]?.legs?.[0];
            if (leg?.distance && leg?.duration) {
              setRoute({
                distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
                durationMin: Math.ceil(leg.duration.value / 60),
                distanceText: leg.distance.text,
                durationText: leg.duration.text,
              });
            }
          } else {
            setError('Route not available for these locations.');
          }
        },
      );
    } catch {
      setLoading(false);
      setError('Could not calculate route.');
    }
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, mapsReady]);

  return { route, loading, error };
}
