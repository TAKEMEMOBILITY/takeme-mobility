// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — QStash Event-Driven Dispatch
// Publishes ride dispatch events to QStash for instant processing.
// QStash calls /api/dispatch/worker within seconds (not minutes like cron).
// Built-in retry with exponential backoff on failure.
// ═══════════════════════════════════════════════════════════════════════════

import { Client } from '@upstash/qstash';

let qstashClient: Client | null = null;

function getQStash(): Client | null {
  if (!qstashClient) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) return null;
    qstashClient = new Client({ token });
  }
  return qstashClient;
}

/**
 * Publish a dispatch event to QStash.
 * QStash will call /api/dispatch/worker with the rideId in the body.
 * Retries 3 times with exponential backoff if the worker fails.
 */
export async function publishDispatchEvent(rideId: string, attempt: number = 0): Promise<boolean> {
  const client = getQStash();
  if (!client) {
    console.warn('[qstash] QStash not configured (QSTASH_TOKEN missing), falling back to Redis queue');
    return false;
  }

  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : null;

  if (!baseUrl) {
    console.warn('[qstash] No VERCEL_URL available for callback');
    return false;
  }

  try {
    // Delay based on attempt number (exponential backoff for retries)
    const delaySec = attempt === 0 ? 0 : Math.min(3 * Math.pow(2, attempt - 1), 30);

    await client.publishJSON({
      url: `${baseUrl}/api/dispatch/worker`,
      body: { rideId, attempt },
      retries: 3,
      ...(delaySec > 0 ? { delay: delaySec } : {}),
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`,
      },
    });

    console.log(`[qstash] Dispatch event published for ride ${rideId} (attempt ${attempt}, delay ${delaySec}s)`);
    return true;
  } catch (err) {
    console.error('[qstash] Failed to publish dispatch event:', err);
    return false;
  }
}

/**
 * Schedule a delayed retry for a ride that wasn't matched.
 */
export async function scheduleDispatchRetry(rideId: string, attempt: number): Promise<boolean> {
  return publishDispatchEvent(rideId, attempt);
}
