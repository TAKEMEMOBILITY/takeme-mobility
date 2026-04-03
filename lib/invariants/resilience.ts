import { createServiceClient } from '@/lib/supabase/service';

// ═══════════════════════════════════════════════════════════════════════════
// INVARIANT 3 — System must ALWAYS degrade gracefully, never crash
//
// Every external service call has: primary → fallback → graceful degradation
// The system must never return 500 to a user for a recoverable error.
// ═══════════════════════════════════════════════════════════════════════════

interface FallbackResult<T> {
  data: T;
  degraded: boolean;
  message?: string;
}

/**
 * Execute primary with timeout → fallback on failure → log degradation.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  options: {
    timeoutMs: number;
    serviceName: string;
    degradationMessage?: string;
  },
): Promise<FallbackResult<T>> {
  try {
    const result = await Promise.race([
      primary(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${options.serviceName} timeout (${options.timeoutMs}ms)`)), options.timeoutMs),
      ),
    ]);
    return { data: result, degraded: false };
  } catch (primaryErr) {
    // Log degradation
    try {
      const svc = createServiceClient();
      await svc.from('monitoring_logs').insert({
        service: options.serviceName,
        status: 'warn',
        latency_ms: options.timeoutMs,
        error: `Degraded: ${(primaryErr as Error).message}. Using fallback.`,
      });
    } catch { /* non-critical */ }

    try {
      const data = await fallback();
      return {
        data,
        degraded: true,
        message: options.degradationMessage ?? `${options.serviceName} is temporarily degraded.`,
      };
    } catch (fallbackErr) {
      // Both failed — trigger reaction engine
      try {
        const { react } = await import('@/lib/security/reactionEngine');
        react(undefined, 65, {
          action: 'service_total_failure',
          resource: options.serviceName,
        }).catch(() => {});
      } catch { /* non-critical */ }

      throw fallbackErr;
    }
  }
}

// ── Service-specific fallback factories ──────────────────────────────────

// In-memory cache for Redis fallback
const memoryCache = new Map<string, { value: unknown; expires: number }>();

export function getFromMemoryCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry || entry.expires < Date.now()) { memoryCache.delete(key); return null; }
  return entry.value as T;
}

export function setInMemoryCache(key: string, value: unknown, ttlMs: number = 300_000): void {
  memoryCache.set(key, { value, expires: Date.now() + ttlMs });
  // Prune
  if (memoryCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of memoryCache) { if (v.expires < now) memoryCache.delete(k); }
  }
}

/**
 * Queue a failed email for retry.
 */
export async function queueFailedEmail(to: string, subject: string, body: string, error: string): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from('failed_emails').insert({ to_address: to, subject, body, error });
  } catch { /* truly last resort */ }
}

/**
 * Queue a payment for retry when Stripe is down.
 */
export async function queuePaymentRetry(rideId: string, amount: number, attempt: number = 0): Promise<void> {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return;

  const item = JSON.stringify({ rideId, amount, attempt, queuedAt: Date.now() });
  try {
    await fetch(`${REDIS_URL}/lpush/queue:payment_retry/${encodeURIComponent(item)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
  } catch { /* non-critical */ }
}
