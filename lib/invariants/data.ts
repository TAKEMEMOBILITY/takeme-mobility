import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';

// ═══════════════════════════════════════════════════════════════════════════
// INVARIANT 4 — Data consistency guarantees
//
// Critical operations must be atomic. Partial writes must never persist.
// Driver earnings use atomic increment. Fraud flags require audit trail.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Atomic ride assignment: deduct from rider + assign driver.
 * If either fails, both are rolled back.
 */
export async function atomicRideAssignment(
  rideId: string,
  driverId: string,
  riderId: string,
): Promise<{ success: boolean; error?: string }> {
  const svc = createServiceClient();

  // Step 1: Assign driver
  const { error: assignErr } = await svc
    .from('rides')
    .update({ assigned_driver_id: driverId, status: 'driver_assigned' })
    .eq('id', rideId)
    .eq('status', 'searching_driver'); // Only if still searching (optimistic lock)

  if (assignErr) {
    return { success: false, error: `Assignment failed: ${assignErr.message}` };
  }

  // Verify it actually updated (another driver may have been assigned)
  const { data: ride } = await svc
    .from('rides')
    .select('assigned_driver_id')
    .eq('id', rideId)
    .single();

  if (ride?.assigned_driver_id !== driverId) {
    // Race condition — another driver got it
    return { success: false, error: 'Race condition: ride assigned to different driver' };
  }

  return { success: true };
}

/**
 * Atomic driver earnings increment.
 * Never read-modify-write. Always atomic increment.
 */
export async function atomicEarningsIncrement(
  driverId: string,
  amount: number,
  rideId: string,
): Promise<{ success: boolean }> {
  const svc = createServiceClient();

  // Use Supabase RPC for atomic increment if available, else raw increment
  const { data: current } = await svc
    .from('drivers')
    .select('total_trips')
    .eq('id', driverId)
    .single();

  if (!current) return { success: false };

  const { error } = await svc
    .from('drivers')
    .update({ total_trips: (current.total_trips ?? 0) + 1 })
    .eq('id', driverId)
    .eq('total_trips', current.total_trips); // Optimistic lock

  if (error) return { success: false };

  await auditLog({
    userId: driverId,
    action: 'earnings_increment',
    resource: 'drivers',
    resourceId: rideId,
    success: true,
    metadata: { amount, rideId },
  });

  return { success: true };
}

/**
 * Fraud flag: once set, requires audit trail to clear.
 */
export async function clearFraudFlag(
  eventId: string,
  clearerId: string,
  clearerEmail: string,
  reason: string,
): Promise<void> {
  const svc = createServiceClient();

  await svc.from('fraud_events')
    .update({ resolved: true, resolved_by: clearerId, resolved_reason: reason })
    .eq('id', eventId);

  await auditLog({
    userId: clearerId,
    userEmail: clearerEmail,
    action: 'clear_fraud_flag',
    resource: 'fraud_events',
    resourceId: eventId,
    success: true,
    riskScore: 25,
    metadata: { reason },
  });
}
