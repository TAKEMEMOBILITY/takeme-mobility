import { useCallback, useEffect, useRef, useState } from 'react';
import {
  searchPlaces,
  getPlaceDetails,
  createSessionToken,
  type PlacePrediction,
  type PlaceDetails,
} from '@/lib/google-places';

interface UseAutocompleteReturn {
  predictions: PlacePrediction[];
  loading: boolean;
  error: string | null;
  search: (query: string) => void;
  selectPlace: (placeId: string) => Promise<PlaceDetails | null>;
  clear: () => void;
}

/**
 * Debounced Google Places autocomplete hook.
 *
 * - 300ms debounce on search input
 * - Session token for billing optimization
 * - Caches selected place details
 * - Clears predictions on selection
 */
export function useAutocomplete(debounceMs = 300): UseAutocompleteReturn {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string>(createSessionToken());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef('');

  const search = useCallback(
    (query: string) => {
      lastQueryRef.current = query;

      // Clear immediately if too short
      if (query.length < 2) {
        setPredictions([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      // Debounce
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        // Skip if query changed during debounce
        if (lastQueryRef.current !== query) return;

        try {
          const results = await searchPlaces(query, sessionRef.current);
          // Skip if query changed during fetch
          if (lastQueryRef.current !== query) return;
          setPredictions(results);
          setError(results.length === 0 && query.length >= 3 ? 'No results found' : null);
        } catch {
          if (lastQueryRef.current === query) {
            setError('Search failed');
            setPredictions([]);
          }
        } finally {
          if (lastQueryRef.current === query) {
            setLoading(false);
          }
        }
      }, debounceMs);
    },
    [debounceMs],
  );

  const selectPlace = useCallback(
    async (placeId: string): Promise<PlaceDetails | null> => {
      try {
        const details = await getPlaceDetails(placeId, sessionRef.current);
        // New session after selection (per Google billing guidance)
        sessionRef.current = createSessionToken();
        setPredictions([]);
        return details;
      } catch {
        return null;
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setPredictions([]);
    setLoading(false);
    setError(null);
    lastQueryRef.current = '';
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { predictions, loading, error, search, selectPlace, clear };
}
