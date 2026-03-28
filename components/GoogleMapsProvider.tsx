'use client';

// ═══════════════════════════════════════════════════════════════════════════
// GoogleMapsProvider — Production-grade map loader
//
// Resilience layers:
//   1. API key validation before loading
//   2. Automatic retry with exponential backoff (3 attempts)
//   3. Timeout protection (15s)
//   4. Graceful degradation — app works without maps
//   5. Zero technical errors exposed to UI
// ═══════════════════════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';

const LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;
const LOAD_TIMEOUT_MS = 15000;

// ── Status machine ───────────────────────────────────────────────────────
export type MapLoadStatus =
  | 'initializing'   // Pre-flight checks
  | 'loading'        // Script loading in progress
  | 'retrying'       // Failed, retrying automatically
  | 'ready'          // Fully operational
  | 'degraded';      // All retries exhausted — app works without maps

interface GoogleMapsContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
  status: MapLoadStatus;
  retry: () => void;       // Manual retry for user-initiated recovery
  attempt: number;         // Current attempt number (for UI messaging)
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

// ── Script loader with retry ─────────────────────────────────────────────

function loadGoogleMapsScript(apiKey: string, libraries: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (typeof google !== 'undefined' && google.maps) {
      resolve();
      return;
    }

    // Already a script tag in flight — wait for it
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('MAP_SCRIPT_BLOCKED')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries.join(',')}&loading=async`;
    script.async = true;
    script.defer = true;

    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error('MAP_LOAD_TIMEOUT'));
    }, LOAD_TIMEOUT_MS);

    script.onload = () => {
      clearTimeout(timeout);
      // Verify the API actually initialized (catches invalid key scenario)
      if (typeof google !== 'undefined' && google.maps) {
        resolve();
      } else {
        reject(new Error('MAP_INIT_FAILED'));
      }
    };

    script.onerror = () => {
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

    // Pre-flight: API key validation
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
        // Exponential backoff: 2s, 4s, 8s
        const delay = RETRY_BASE_MS * Math.pow(2, currentAttempt - 1);
        loadingRef.current = false;
        setTimeout(() => {
          if (mountedRef.current) {
            attemptLoad(currentAttempt + 1);
          }
        }, delay);
      } else {
        setStatus('degraded');
      }
    } finally {
      loadingRef.current = false;
    }
  }, [apiKey]);

  // Manual retry — resets the entire cycle
  const retry = useCallback(() => {
    // Remove any existing failed script tags to allow fresh load
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
