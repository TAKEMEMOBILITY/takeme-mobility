// ═══════════════════════════════════════════════════════════════════════════
// INVARIANT 5 — Circuit Breaker
//
// CLOSED → OPEN (5 failures in 60s) → HALF_OPEN (30s later, 1 test)
// → CLOSED (test passes) or → OPEN (test fails)
//
// State stored in Redis. If Redis is down, defaults to CLOSED (allow).
// ═══════════════════════════════════════════════════════════════════════════

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const rh = () => ({ Authorization: `Bearer ${REDIS_TOKEN!}` });

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_SEC = 60;
const OPEN_DURATION_SEC = 30;

const SERVICES = ['supabase_db', 'supabase_auth', 'stripe_api', 'aws_ses', 'aws_sns', 'ably_realtime', 'qstash'] as const;
export type CircuitService = typeof SERVICES[number];

// In-memory fallback when Redis is down
const memoryState = new Map<string, { state: CircuitState; failures: number; lastFailure: number }>();

async function redisGet(key: string): Promise<string | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}/get/${key}`, { headers: rh() });
    const body = await res.json();
    return body.result ?? null;
  } catch { return null; }
}

async function redisSet(key: string, value: string, ttl?: number): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  try {
    const url = ttl ? `${REDIS_URL}/set/${key}/${encodeURIComponent(value)}/ex/${ttl}` : `${REDIS_URL}/set/${key}/${encodeURIComponent(value)}`;
    await fetch(url, { headers: rh() });
  } catch { /* non-critical */ }
}

async function redisIncr(key: string, ttl: number): Promise<number> {
  if (!REDIS_URL || !REDIS_TOKEN) return 0;
  try {
    const res = await fetch(`${REDIS_URL}/incr/${key}`, { headers: rh() });
    const body = await res.json();
    // Set TTL on first increment
    if (body.result === 1) await fetch(`${REDIS_URL}/expire/${key}/${ttl}`, { headers: rh() });
    return body.result ?? 0;
  } catch { return 0; }
}

/**
 * Get current circuit state for a service.
 */
export async function getCircuitState(service: CircuitService): Promise<CircuitState> {
  const state = await redisGet(`circuit:${service}:state`);
  if (state === 'OPEN') {
    // Check if open duration has passed → transition to HALF_OPEN
    const lastFail = await redisGet(`circuit:${service}:last_failure`);
    if (lastFail && Date.now() - Number(lastFail) > OPEN_DURATION_SEC * 1000) {
      await redisSet(`circuit:${service}:state`, 'HALF_OPEN', 120);
      return 'HALF_OPEN';
    }
    return 'OPEN';
  }
  if (state === 'HALF_OPEN') return 'HALF_OPEN';
  return 'CLOSED';
}

/**
 * Record a failure for a service.
 * Returns new circuit state after recording.
 */
export async function recordFailure(service: CircuitService): Promise<CircuitState> {
  const failureCount = await redisIncr(`circuit:${service}:failures`, FAILURE_WINDOW_SEC);
  await redisSet(`circuit:${service}:last_failure`, String(Date.now()), FAILURE_WINDOW_SEC);

  const currentState = await getCircuitState(service);

  if (currentState === 'HALF_OPEN') {
    // Test failed → back to OPEN
    await redisSet(`circuit:${service}:state`, 'OPEN', OPEN_DURATION_SEC + 10);
    await redisSet(`circuit:${service}:last_failure`, String(Date.now()), OPEN_DURATION_SEC + 10);
    return 'OPEN';
  }

  if (failureCount >= FAILURE_THRESHOLD && currentState === 'CLOSED') {
    // Trip the breaker
    await redisSet(`circuit:${service}:state`, 'OPEN', OPEN_DURATION_SEC + 10);
    return 'OPEN';
  }

  return currentState;
}

/**
 * Record a success for a service.
 */
export async function recordSuccess(service: CircuitService): Promise<void> {
  const currentState = await getCircuitState(service);

  if (currentState === 'HALF_OPEN') {
    // Test passed → close circuit
    await redisSet(`circuit:${service}:state`, 'CLOSED', 300);
    await redisSet(`circuit:${service}:failures`, '0', FAILURE_WINDOW_SEC);
  }
}

/**
 * Execute a function with circuit breaker protection.
 * If circuit is OPEN, immediately returns fallback.
 */
export async function withCircuitBreaker<T>(
  service: CircuitService,
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<{ data: T; circuitState: CircuitState; usedFallback: boolean }> {
  const state = await getCircuitState(service);

  if (state === 'OPEN') {
    const data = await fallback();
    return { data, circuitState: 'OPEN', usedFallback: true };
  }

  try {
    const data = await primary();
    await recordSuccess(service);
    return { data, circuitState: 'CLOSED', usedFallback: false };
  } catch (err) {
    const newState = await recordFailure(service);
    try {
      const data = await fallback();
      return { data, circuitState: newState, usedFallback: true };
    } catch {
      throw err; // Both primary and fallback failed
    }
  }
}

/**
 * Get all circuit states (for monitoring dashboard).
 */
export async function getAllCircuitStates(): Promise<Record<string, CircuitState>> {
  const result: Record<string, CircuitState> = {};
  for (const svc of SERVICES) {
    result[svc] = await getCircuitState(svc);
  }
  return result;
}
