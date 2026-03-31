import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { API } from '@takeme/shared';

export const BACKGROUND_LOCATION_TASK = 'DRIVER_LOCATION_BROADCAST';

/**
 * Background task that receives location updates and sends them to the API.
 * Defined at top level so expo-task-manager registers it before app mounts.
 * Includes auth token from SecureStore for authenticated API calls.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundLocation] Error:', error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as {
    locations: Array<{
      coords: {
        latitude: number;
        longitude: number;
        heading: number | null;
        speed: number | null;
      };
      timestamp: number;
    }>;
  };

  const latest = locations[locations.length - 1];
  if (!latest) return;

  try {
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) return;

    // Retrieve auth token from SecureStore
    // Supabase stores session as JSON in SecureStore via the adapter
    let accessToken: string | null = null;
    try {
      // Try common Supabase session key patterns
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const ref = supabaseUrl.match(/https?:\/\/([^.]+)/)?.[1] ?? '';
      const sessionKey = `sb-${ref}-auth-token`;
      const sessionJson = await SecureStore.getItemAsync(sessionKey);
      if (sessionJson) {
        const parsed = JSON.parse(sessionJson);
        // Supabase stores { access_token, refresh_token, ... } or session object
        accessToken = parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
      }
    } catch {
      // Token retrieval failed, send without auth (will get 401)
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    await fetch(`${apiBaseUrl}${API.DRIVER_LOCATION}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lat: latest.coords.latitude,
        lng: latest.coords.longitude,
        heading: latest.coords.heading,
        speedKmh: latest.coords.speed ? latest.coords.speed * 3.6 : null,
      }),
    });
  } catch (err) {
    console.error('[BackgroundLocation] Failed to send location:', err);
  }
});
