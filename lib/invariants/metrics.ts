// ═══════════════════════════════════════════════════════════════════════════
// Invariant Metrics — Track violations, near-misses, recovery time, MTTR
// ═══════════════════════════════════════════════════════════════════════════

import { createServiceClient } from '@/lib/supabase/service';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const rh = () => ({ Authorization: `Bearer ${REDIS_TOKEN!}` });

const today = () => new Date().toISOString().slice(0, 10);

async function redisIncr(key: string, ttl = 86400): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  try {
    const res = await fetch(`${REDIS_URL}/incr/${key}`, { headers: rh() });
    const body = await res.json();
    if (body.result === 1) await fetch(`${REDIS_URL}/expire/${key}/${ttl}`, { headers: rh() });
  } catch { /* non-critical */ }
}

async function redisGet(key: string): Promise<string | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}/get/${key}`, { headers: rh() });
    const body = await res.json();
    return body.result ?? null;
  } catch { return null; }
}

export async function recordViolationMetric(invariant: string, shadow: boolean): Promise<void> {
  const d = today();
  if (shadow) {
    await redisIncr(`invariant:${invariant}:shadow_violations`);
  } else {
    await redisIncr(`violation_count:${invariant}:${d}`);
  }
  // Update last_violation timestamp
  if (!shadow && REDIS_URL && REDIS_TOKEN) {
    await fetch(`${REDIS_URL}/set/last_violation:${invariant}/${Date.now()}`, { headers: rh() }).catch(() => {});
  }
}

export async function recordNearMissMetric(invariant: string): Promise<void> {
  await redisIncr(`near_miss_count:${invariant}:${today()}`);
}

export async function recordRecoveryTime(invariant: string, ms: number): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  // Rolling average stored in Redis
  const key = `recovery_time_ms:${invariant}`;
  const prev = await redisGet(key);
  const prevMs = prev ? Number(prev) : ms;
  const avg = Math.round((prevMs * 0.8) + (ms * 0.2)); // Exponential moving average
  await fetch(`${REDIS_URL}/set/${key}/${avg}`, { headers: rh() }).catch(() => {});
}

export interface InvariantMetrics {
  name: string;
  violations_today: number;
  violations_7d: number;
  violations_30d: number;
  near_misses_today: number;
  shadow_violations: number;
  avg_recovery_time_ms: number;
  last_violation_at: string | null;
  mttr_7d: number;
  current_status: 'healthy' | 'near_miss' | 'violated' | 'recovering';
}

export async function getInvariantMetrics(invariant: string): Promise<InvariantMetrics> {
  const d = today();

  const [violToday, nearMissToday, shadowV, recoveryMs, lastViolation] = await Promise.all([
    redisGet(`violation_count:${invariant}:${d}`),
    redisGet(`near_miss_count:${invariant}:${d}`),
    redisGet(`invariant:${invariant}:shadow_violations`),
    redisGet(`recovery_time_ms:${invariant}`),
    redisGet(`last_violation:${invariant}`),
  ]);

  const vToday = Number(violToday ?? 0);
  const nmToday = Number(nearMissToday ?? 0);
  const lastTs = lastViolation ? Number(lastViolation) : null;

  // Get 7d and 30d from DB
  const svc = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [v7d, v30d] = await Promise.all([
    svc.from('invariant_violations').select('*', { count: 'exact', head: true }).eq('invariant', invariant).eq('shadow', false).gte('created_at', sevenDaysAgo),
    svc.from('invariant_violations').select('*', { count: 'exact', head: true }).eq('invariant', invariant).eq('shadow', false).gte('created_at', thirtyDaysAgo),
  ]);

  const avgRecovery = Number(recoveryMs ?? 0);

  let status: InvariantMetrics['current_status'] = 'healthy';
  if (vToday > 0) {
    const recentEnough = lastTs && (Date.now() - lastTs) < 300_000; // within 5 min
    status = recentEnough ? 'violated' : 'recovering';
  } else if (nmToday > 0) {
    status = 'near_miss';
  }

  return {
    name: invariant,
    violations_today: vToday,
    violations_7d: v7d.count ?? 0,
    violations_30d: v30d.count ?? 0,
    near_misses_today: nmToday,
    shadow_violations: Number(shadowV ?? 0),
    avg_recovery_time_ms: avgRecovery,
    last_violation_at: lastTs ? new Date(lastTs).toISOString() : null,
    mttr_7d: avgRecovery, // Same rolling average for simplicity
    current_status: status,
  };
}

export async function getAllMetrics(): Promise<InvariantMetrics[]> {
  const names = ['auth', 'payments', 'data', 'resilience', 'circuit', 'contract'];
  return Promise.all(names.map(getInvariantMetrics));
}
