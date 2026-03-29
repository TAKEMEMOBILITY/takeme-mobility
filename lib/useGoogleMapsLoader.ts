'use client';

// ═══════════════════════════════════════════════════════════════════════════
// useGoogleMapsLoader — loads Google Maps JS API via callback pattern.
// Zero module-level references to google.*. Safe for SSR.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

let loadPromise: Promise<boolean> | null = null;

function loadScript(apiKey: string): Promise<boolean> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(false); return; }

    // Already loaded
    if (typeof google !== 'undefined' && google.maps?.Map) {
      resolve(true);
      return;
    }

    if (!apiKey) { resolve(false); return; }

    const cbName = '__takeme_gmaps_cb';
    (window as unknown as Record<string, unknown>)[cbName] = () => {
      delete (window as unknown as Record<string, unknown>)[cbName];
      resolve(typeof google !== 'undefined' && !!google.maps?.Map);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${cbName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete (window as unknown as Record<string, unknown>)[cbName];
      loadPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function useGoogleMapsLoader() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already loaded from a previous mount
    if (typeof google !== 'undefined' && google.maps?.Map) {
      setReady(true);
      return;
    }

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!key) { setFailed(true); return; }

    loadScript(key).then((ok) => {
      if (ok) setReady(true);
      else setFailed(true);
    });
  }, []);

  return { ready, failed };
}
