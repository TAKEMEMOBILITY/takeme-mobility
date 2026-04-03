// ═══════════════════════════════════════════════════════════════════════════
// Invariant Shadow Mode
//
// Shadow = observe but don't block. Safe rollout of new invariant rules.
// After 48h with < 5 violations → auto-promote to enforced.
// ═══════════════════════════════════════════════════════════════════════════

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const rh = () => ({ Authorization: `Bearer ${REDIS_TOKEN!}` });

export async function isInShadowMode(invariant: string): Promise<boolean> {
  if (!REDIS_URL || !REDIS_TOKEN) return false;
  try {
    const res = await fetch(`${REDIS_URL}/get/invariant:${invariant}:shadow_mode`, { headers: rh() });
    const body = await res.json();
    return body.result === 'true';
  } catch { return false; }
}

export async function setShadowMode(invariant: string, enabled: boolean): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  if (enabled) {
    // Set shadow mode with timestamp for 48h tracking
    await fetch(`${REDIS_URL}/set/invariant:${invariant}:shadow_mode/true`, { headers: rh() });
    await fetch(`${REDIS_URL}/set/invariant:${invariant}:shadow_start/${Date.now()}/ex/172800`, { headers: rh() });
  } else {
    await fetch(`${REDIS_URL}/del/invariant:${invariant}:shadow_mode`, { headers: rh() });
    await fetch(`${REDIS_URL}/del/invariant:${invariant}:shadow_start`, { headers: rh() });
  }
}

export async function getShadowStatus(invariant: string): Promise<{
  enabled: boolean;
  startedAt: number | null;
  hoursActive: number;
  readyToEnforce: boolean;
}> {
  if (!REDIS_URL || !REDIS_TOKEN) return { enabled: false, startedAt: null, hoursActive: 0, readyToEnforce: false };

  const enabled = await isInShadowMode(invariant);
  if (!enabled) return { enabled: false, startedAt: null, hoursActive: 0, readyToEnforce: false };

  try {
    const res = await fetch(`${REDIS_URL}/get/invariant:${invariant}:shadow_start`, { headers: rh() });
    const body = await res.json();
    const startedAt = body.result ? Number(body.result) : null;
    const hoursActive = startedAt ? (Date.now() - startedAt) / 3_600_000 : 0;

    // Check shadow violation count
    const vRes = await fetch(`${REDIS_URL}/get/invariant:${invariant}:shadow_violations`, { headers: rh() });
    const vBody = await vRes.json();
    const shadowViolations = Number(vBody.result ?? 0);

    const readyToEnforce = hoursActive >= 48 && shadowViolations < 5;

    return { enabled, startedAt, hoursActive: Math.round(hoursActive * 10) / 10, readyToEnforce };
  } catch { return { enabled: true, startedAt: null, hoursActive: 0, readyToEnforce: false }; }
}

export async function getAllShadowStatuses(): Promise<Record<string, Awaited<ReturnType<typeof getShadowStatus>>>> {
  const invariants = ['auth', 'payments', 'data', 'resilience', 'circuit', 'contract'];
  const result: Record<string, Awaited<ReturnType<typeof getShadowStatus>>> = {};
  for (const inv of invariants) {
    result[inv] = await getShadowStatus(inv);
  }
  return result;
}
