// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — Ably Realtime for Live Driver Location
// Sub-200ms location streaming from driver to rider.
//
// Architecture:
//   Driver app → POST /api/driver/location → DB + Ably publish
//   Rider app → Ably subscribe → live map marker updates
//
// Channel naming: driver:{driverId}
// Message name: location
// ═══════════════════════════════════════════════════════════════════════════

import Ably from 'ably';

let ablyClient: Ably.Rest | null = null;

function getAblyServer(): Ably.Rest {
  if (!ablyClient) {
    const key = process.env.ABLY_KEY;
    if (!key) throw new Error('ABLY_KEY environment variable required');
    ablyClient = new Ably.Rest({ key });
  }
  return ablyClient;
}

interface DriverLocationUpdate {
  driverId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speedKmh: number | null;
  timestamp: number;
}

/**
 * Publish driver location to Ably channel (server-side).
 * Called from the driver location API endpoint after DB update.
 */
export async function publishDriverLocation(data: DriverLocationUpdate): Promise<void> {
  try {
    const ably = getAblyServer();
    const channel = ably.channels.get(`driver:${data.driverId}`);
    await channel.publish('location', data);
  } catch (err) {
    // Non-fatal — DB update already succeeded, Ably is enhancement
    console.error('[ably] Failed to publish location:', err);
  }
}

/**
 * Publish ride status update to Ably (for faster UI updates than Supabase Realtime).
 */
export async function publishRideUpdate(rideId: string, data: {
  status: string;
  driverId?: string;
  driverName?: string;
  eta?: number;
}): Promise<void> {
  try {
    const ably = getAblyServer();
    const channel = ably.channels.get(`ride:${rideId}`);
    await channel.publish('status', { ...data, timestamp: Date.now() });
  } catch (err) {
    console.error('[ably] Failed to publish ride update:', err);
  }
}

/**
 * Generate an Ably token for client-side subscription (rider/driver apps).
 * Called from /api/ably-token endpoint.
 */
export async function createAblyToken(clientId: string): Promise<Ably.TokenDetails> {
  const ably = getAblyServer();
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId,
    capability: {
      'driver:*': ['subscribe'],
      'ride:*': ['subscribe'],
    },
  });
  // createTokenRequest returns a TokenRequest, client uses it to get a token
  // For simplicity, we return a token directly
  const token = await ably.auth.requestToken({
    clientId,
    capability: JSON.stringify({
      'driver:*': ['subscribe'],
      'ride:*': ['subscribe'],
    }),
  });
  return token;
}
