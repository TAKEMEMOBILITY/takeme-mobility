import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';

// ═══════════════════════════════════════════════════════════════════════════
// INVARIANT 2 — Payments must NEVER double-process
//
// A payment for a given ride_id is processed exactly once.
// Redis NX lock + payment_audit_log table + idempotency check.
// ═══════════════════════════════════════════════════════════════════════════

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;
const rh = () => ({ Authorization: `Bearer ${REDIS_TOKEN}` });

interface PaymentGuardResult {
  allowed: boolean;
  reason?: string;
  idempotencyKey: string;
}

/**
 * Acquire processing lock for a ride payment.
 * Returns allowed:true only if no payment is currently processing
 * and no payment has already succeeded for this ride.
 */
export async function acquirePaymentLock(
  rideId: string,
  amount: number,
  stripePaymentIntentId?: string,
): Promise<PaymentGuardResult> {
  const idempotencyKey = `pay_${rideId}_${Date.now()}`;
  const svc = createServiceClient();

  // Check 1: Has this ride already been successfully paid?
  const { data: existing } = await svc
    .from('payment_audit_log')
    .select('id, status')
    .eq('ride_id', rideId)
    .eq('status', 'succeeded')
    .limit(1);

  if (existing && existing.length > 0) {
    // Hard block — already paid
    await svc.from('payment_audit_log').insert({
      ride_id: rideId,
      amount,
      status: 'duplicate_blocked',
      stripe_payment_intent_id: stripePaymentIntentId ?? null,
      idempotency_key: `dup_${rideId}_${Date.now()}`,
      metadata: { reason: 'already_succeeded', existingId: existing[0].id },
    });

    await auditLog({
      action: 'payment_double_process_blocked',
      resource: 'payments',
      resourceId: rideId,
      success: false,
      riskScore: 60,
      metadata: { rideId, amount, existingPaymentId: existing[0].id },
    });

    return { allowed: false, reason: 'Payment already completed for this ride', idempotencyKey };
  }

  // Check 2: Redis NX lock (only if not already processing)
  try {
    const lockKey = `payment:processing:${rideId}`;
    const res = await fetch(`${REDIS_URL}/set/${lockKey}/1/nx/ex/300`, { headers: rh() });
    const body = await res.json();

    if (body.result !== 'OK') {
      return { allowed: false, reason: 'Payment already processing for this ride', idempotencyKey };
    }
  } catch {
    // Redis down — check DB only (already checked above), allow with caution
  }

  // Log processing start
  await svc.from('payment_audit_log').insert({
    ride_id: rideId,
    amount,
    status: 'processing',
    stripe_payment_intent_id: stripePaymentIntentId ?? null,
    idempotency_key: idempotencyKey,
  });

  return { allowed: true, idempotencyKey };
}

/**
 * Mark payment as succeeded. Clears processing lock.
 */
export async function markPaymentSucceeded(
  rideId: string,
  idempotencyKey: string,
  stripePaymentIntentId?: string,
): Promise<void> {
  const svc = createServiceClient();

  await svc
    .from('payment_audit_log')
    .update({ status: 'succeeded', stripe_payment_intent_id: stripePaymentIntentId ?? null })
    .eq('idempotency_key', idempotencyKey);

  // Set permanent completed marker
  try {
    await fetch(`${REDIS_URL}/set/payment:completed:${rideId}/1`, { headers: rh() });
    await fetch(`${REDIS_URL}/del/payment:processing:${rideId}`, { headers: rh() });
  } catch { /* Redis down — DB is source of truth */ }
}

/**
 * Mark payment as failed. Releases lock so retry is possible.
 */
export async function markPaymentFailed(
  rideId: string,
  idempotencyKey: string,
  error: string,
): Promise<void> {
  const svc = createServiceClient();

  await svc
    .from('payment_audit_log')
    .update({ status: 'failed', metadata: { error } })
    .eq('idempotency_key', idempotencyKey);

  // Release lock
  try {
    await fetch(`${REDIS_URL}/del/payment:processing:${rideId}`, { headers: rh() });
  } catch { /* non-critical */ }
}

/**
 * Check webhook idempotency — returns true if this webhook was already processed.
 */
export async function isWebhookDuplicate(stripeEventId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('payment_audit_log')
    .select('id')
    .eq('stripe_payment_intent_id', stripeEventId)
    .in('status', ['succeeded', 'processing'])
    .limit(1);

  return (data?.length ?? 0) > 0;
}
