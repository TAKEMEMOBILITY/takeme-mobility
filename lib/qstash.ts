// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — QStash Event-Driven Dispatch
// Instant dispatch on ride creation + 15s timeout scheduling.
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

function getWorkerUrl(): string | null {
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ?? process.env.VERCEL_URL
    ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!vercelUrl) return null;
  const base = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
  return `${base}/api/dispatch/worker`;
}

/**
 * Publish dispatch event — triggers worker immediately.
 * Called when a new ride is created.
 */
export async function publishDispatchEvent(rideId: string, attempt: number = 0): Promise<boolean> {
  const client = getQStash();
  const url = getWorkerUrl();
  if (!client || !url) return false;

  try {
    await client.publishJSON({
      url,
      body: { rideId, attempt, action: 'dispatch' },
      retries: 2,
      headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET ?? ''}` },
    });
    console.log(`[qstash] Dispatch event → ride ${rideId} (attempt ${attempt})`);
    return true;
  } catch (err) {
    console.error('[qstash] Publish failed:', err);
    return false;
  }
}

/**
 * Schedule a timeout check — fires 15 seconds after offer is sent.
 * If driver hasn't accepted by then, the worker will escalate.
 */
export async function scheduleOfferTimeout(rideId: string, attempt: number): Promise<boolean> {
  const client = getQStash();
  const url = getWorkerUrl();
  if (!client || !url) return false;

  try {
    await client.publishJSON({
      url,
      body: { rideId, attempt, action: 'timeout_check' },
      delay: 15, // 15 seconds
      retries: 1,
      headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET ?? ''}` },
    });
    console.log(`[qstash] Timeout scheduled → ride ${rideId} in 15s`);
    return true;
  } catch (err) {
    console.error('[qstash] Timeout schedule failed:', err);
    return false;
  }
}

/**
 * Schedule a delayed retry for dispatch.
 */
export async function scheduleDispatchRetry(rideId: string, attempt: number): Promise<boolean> {
  return publishDispatchEvent(rideId, attempt);
}
