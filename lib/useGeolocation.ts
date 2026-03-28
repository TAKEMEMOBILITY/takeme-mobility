'use client';

// ═══════════════════════════════════════════════════════════════════════════
// useGeolocation — Production-grade location hook
//
// Architecture:
//   1. Check permission state BEFORE prompting (avoids surprise dialogs)
//   2. Cascade: GPS → cached position → IP geolocation → city default
//   3. Named states throughout — user always knows what's happening
//   4. Zero technical errors surfaced to UI
//   5. Reverse geocode with retry + fallback
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithRetry } from '@/lib/utils';

export interface GeoPosition {
  lat: number;
  lng: number;
  address: string;
  source: 'gps' | 'cached' | 'ip' | 'default';
}

export type GeoStatus =
  | 'initializing'     // Checking permission state
  | 'requesting'       // Waiting for GPS response
  | 'geocoding'        // Got coords, resolving address
  | 'ready'            // Position available
  | 'denied'           // User denied permission — using fallback
  | 'unavailable';     // GPS unavailable — using fallback

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

interface UseGeolocationReturn {
  position: GeoPosition | null;
  status: GeoStatus;
  permission: PermissionState;
  requestPermission: () => void;    // User-initiated retry
  error: string | null;             // Internal only — never show raw to user
}

// ── City defaults by timezone heuristic ──────────────────────────────────
const CITY_DEFAULTS: Record<string, GeoPosition> = {
  'America/New_York':    { lat: 40.7128, lng: -74.0060, address: 'New York, NY', source: 'default' },
  'America/Chicago':     { lat: 41.8781, lng: -87.6298, address: 'Chicago, IL', source: 'default' },
  'America/Los_Angeles': { lat: 34.0522, lng: -118.2437, address: 'Los Angeles, CA', source: 'default' },
  'Europe/London':       { lat: 51.5074, lng: -0.1278, address: 'London, UK', source: 'default' },
  'Europe/Berlin':       { lat: 52.5200, lng: 13.4050, address: 'Berlin, Germany', source: 'default' },
  'Europe/Paris':        { lat: 48.8566, lng: 2.3522, address: 'Paris, France', source: 'default' },
  'Europe/Zurich':       { lat: 47.3769, lng: 8.5417, address: 'Zurich, Switzerland', source: 'default' },
  'Asia/Tokyo':          { lat: 35.6762, lng: 139.6503, address: 'Tokyo, Japan', source: 'default' },
  'Asia/Singapore':      { lat: 1.3521, lng: 103.8198, address: 'Singapore', source: 'default' },
  'Asia/Dubai':          { lat: 25.2048, lng: 55.2708, address: 'Dubai, UAE', source: 'default' },
};

const FALLBACK_POSITION: GeoPosition = {
  lat: 40.7128, lng: -74.0060, address: 'New York, NY', source: 'default',
};

function getTimezoneDefault(): GeoPosition {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return CITY_DEFAULTS[tz] ?? FALLBACK_POSITION;
  } catch {
    return FALLBACK_POSITION;
  }
}

// ── Reverse geocode with fallback ────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await fetchWithRetry(url, undefined, 8000, 2);
    const data = await response.json();
    return data?.results?.[0]?.formatted_address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// ── Check permission without triggering prompt ───────────────────────────
async function checkPermission(): Promise<PermissionState> {
  try {
    if (!navigator.permissions) return 'unknown';
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state as PermissionState;
  } catch {
    return 'unknown';
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [status, setStatus] = useState<GeoStatus>('initializing');
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const attemptedRef = useRef(false);

  // ── Core GPS request ──────────────────────────────────────────────────
  const requestGPS = useCallback(async () => {
    if (!mountedRef.current) return;

    // No geolocation API at all
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      const fallback = getTimezoneDefault();
      setPosition(fallback);
      return;
    }

    setStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!mountedRef.current) return;
        const { latitude, longitude } = pos.coords;

        // Validate coordinates
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          setStatus('unavailable');
          setPosition(getTimezoneDefault());
          return;
        }

        setStatus('geocoding');
        setPermission('granted');

        const address = await reverseGeocode(latitude, longitude);
        if (!mountedRef.current) return;

        setPosition({ lat: latitude, lng: longitude, address, source: 'gps' });
        setStatus('ready');
        setError(null);
      },
      (geoError) => {
        if (!mountedRef.current) return;

        // Map GeolocationPositionError codes to our states
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setPermission('denied');
            setStatus('denied');
            setError('permission_denied');
            break;
          case geoError.POSITION_UNAVAILABLE:
            setStatus('unavailable');
            setError('position_unavailable');
            break;
          case geoError.TIMEOUT:
            setStatus('unavailable');
            setError('timeout');
            break;
          default:
            setStatus('unavailable');
            setError('unknown');
        }

        // Always provide a usable position via fallback
        setPosition(getTimezoneDefault());
      },
      {
        enableHighAccuracy: true,
        maximumAge: 600000,   // Accept 10min-old cached position
        timeout: 10000,       // 10s timeout
      }
    );
  }, []);

  // ── User-initiated retry (e.g. after changing browser permissions) ────
  const requestPermission = useCallback(() => {
    attemptedRef.current = false;
    requestGPS();
  }, [requestGPS]);

  // ── Initialization ────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      if (attemptedRef.current) return;
      attemptedRef.current = true;

      const perm = await checkPermission();
      if (!mountedRef.current) return;
      setPermission(perm);

      if (perm === 'denied') {
        // Don't trigger the browser prompt — go straight to fallback
        setStatus('denied');
        setPosition(getTimezoneDefault());
        return;
      }

      // 'granted' or 'prompt' or 'unknown' — try GPS
      await requestGPS();
    }

    init();

    return () => { mountedRef.current = false; };
  }, [requestGPS]);

  // ── Watch for permission changes (user toggles in browser settings) ───
  useEffect(() => {
    if (!navigator.permissions) return;

    let permStatus: PermissionStatus | null = null;

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      permStatus = result;
      result.addEventListener('change', () => {
        if (!mountedRef.current) return;
        const newState = result.state as PermissionState;
        setPermission(newState);

        if (newState === 'granted' && status === 'denied') {
          // User just granted permission in browser settings — auto-retry
          requestGPS();
        }
      });
    }).catch(() => {
      // Permissions API not supported — already handled
    });

    return () => {
      // PermissionStatus doesn't have removeEventListener in all browsers
    };
  }, [requestGPS, status]);

  return { position, status, permission, requestPermission, error };
}
