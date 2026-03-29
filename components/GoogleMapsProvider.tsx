'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';

const LIBRARIES = ['places', 'geometry'];
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;
const LOAD_TIMEOUT_MS = 15000;

export type MapLoadStatus = 'initializing' | 'loading' | 'retrying' | 'ready' | 'degraded';

interface GoogleMapsContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
  status: MapLoadStatus;
  retry: () => void;
  attempt: number;
  maxAttempts: number;
}

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: undefined,
  status: 'initializing',
  retry: () => {},
  attempt: 0,
  maxAttempts: MAX_RETRIES,
});

// ── Script loader ────────────────────────────────────────────────────────
// Uses a global callback instead of script.onload + loading=async.
// The callback fires AFTER the API is fully initialized, not just when
// the script file is downloaded. This prevents "google.maps.Map is not
// a constructor" errors.

let callbackId = 0;

function loadGoogleMapsScript(apiKey: string, libraries: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already fully loaded — verify a constructor works
    if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
      resolve();
      return;
    }

    // Already a script in flight — wait for callback
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      // Poll until google.maps.Map exists (script may have loaded but not initialized)
      const poll = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
          clearInterval(poll);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(poll); reject(new Error('MAP_INIT_TIMEOUT')); }, LOAD_TIMEOUT_MS);
      return;
    }

    // Create a unique global callback name
    const cbName = `__takeme_maps_cb_${++callbackId}`;
    (window as unknown as Record<string, unknown>)[cbName] = () => {
      delete (window as unknown as Record<string, unknown>)[cbName];
      clearTimeout(timeout);
      // Final verification
      if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
        resolve();
      } else {
        reject(new Error('MAP_INIT_FAILED'));
      }
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries.join(',')}&callback=${cbName}`;
    script.async = true;
    script.defer = true;

    const timeout = setTimeout(() => {
      delete (window as unknown as Record<string, unknown>)[cbName];
      script.remove();
      reject(new Error('MAP_LOAD_TIMEOUT'));
    }, LOAD_TIMEOUT_MS);

    script.onerror = () => {
      delete (window as unknown as Record<string, unknown>)[cbName];
      clearTimeout(timeout);
      script.remove();
      reject(new Error('MAP_SCRIPT_ERROR'));
    };

    document.head.appendChild(script);
  });
}

// ── Provider ─────────────────────────────────────────────────────────────

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MapLoadStatus>('initializing');
  const [loadError, setLoadError] = useState<Error | undefined>();
  const [attempt, setAttempt] = useState(0);
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  const attemptLoad = useCallback(async (currentAttempt: number) => {
    if (!mountedRef.current || loadingRef.current) return;
    loadingRef.current = true;

    if (!apiKey || apiKey.length < 10) {
      setStatus('degraded');
      setLoadError(new Error('MAP_KEY_MISSING'));
      loadingRef.current = false;
      return;
    }

    setAttempt(currentAttempt);
    setStatus(currentAttempt === 1 ? 'loading' : 'retrying');

    try {
      await loadGoogleMapsScript(apiKey, LIBRARIES);
      if (mountedRef.current) {
        setStatus('ready');
        setLoadError(undefined);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const error = err instanceof Error ? err : new Error('MAP_UNKNOWN_ERROR');
      setLoadError(error);

      if (currentAttempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, currentAttempt - 1);
        loadingRef.current = false;
        setTimeout(() => {
          if (mountedRef.current) attemptLoad(currentAttempt + 1);
        }, delay);
      } else {
        setStatus('degraded');
      }
    } finally {
      loadingRef.current = false;
    }
  }, [apiKey]);

  const retry = useCallback(() => {
    document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach(s => s.remove());
    setLoadError(undefined);
    loadingRef.current = false;
    attemptLoad(1);
  }, [attemptLoad]);

  useEffect(() => {
    mountedRef.current = true;
    attemptLoad(1);
    return () => { mountedRef.current = false; };
  }, [attemptLoad]);

  return (
    <GoogleMapsContext.Provider value={{
      isLoaded: status === 'ready',
      loadError,
      status,
      retry,
      attempt,
      maxAttempts: MAX_RETRIES,
    }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps(): GoogleMapsContextValue {
  return useContext(GoogleMapsContext);
}
