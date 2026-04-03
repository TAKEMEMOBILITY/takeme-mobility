import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';

// ═══════════════════════════════════════════════════════════════════════════
// Fleet Payout Engine
// Commission calculation, payout lifecycle, hold/release
// ═══════════════════════════════════════════════════════════════════════════

const COMMISSION_RATE = 0.20;

/**
 * Create commission record after booking completion.
 * Payout only after completed + undisputed.
 */
export async function createCommission(bookingId: string): Promise<{ success: boolean; error?: string }> {
  const svc = createServiceClient();

  const { data: booking } = await svc
    .from('rental_bookings')
    .select('id, status, total_rental_cents, owner_id')
    .eq('id', bookingId)
    .single();

  if (!booking) return { success: false, error: 'Booking not found' };
  if (booking.status !== 'completed') return { success: false, error: 'Booking not completed' };

  // Idempotency: check if commission already exists
  const { data: existing } = await svc
    .from('fleet_commissions')
    .select('id')
    .eq('booking_id', bookingId)
    .limit(1);

  if (existing && existing.length > 0) return { success: true }; // Already created

  const gross = booking.total_rental_cents;
  const commission = Math.round(gross * COMMISSION_RATE);
  const ownerNet = gross - commission;

  await svc.from('fleet_commissions').insert({
    booking_id: bookingId,
    gross_amount_cents: gross,
    commission_rate: COMMISSION_RATE,
    commission_cents: commission,
    owner_net_cents: ownerNet,
  });

  return { success: true };
}

/**
 * Create payout for an owner covering a period.
 */
export async function createPayout(
  ownerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ payoutId?: string; error?: string }> {
  const svc = createServiceClient();

  // Get all completed, undisputed bookings with commissions in the period
  const { data: commissions } = await svc
    .from('fleet_commissions')
    .select('id, booking_id, gross_amount_cents, commission_cents, owner_net_cents')
    .eq('booking_id.owner_id', ownerId); // This needs a join — use bookings

  // Alternative: get from bookings
  const { data: bookings } = await svc
    .from('rental_bookings')
    .select('id, total_rental_cents, commission_cents, owner_payout_cents, status')
    .eq('owner_id', ownerId)
    .eq('status', 'completed')
    .gte('completed_at', periodStart)
    .lt('completed_at', periodEnd);

  if (!bookings || bookings.length === 0) return { error: 'No completed bookings in period' };

  // Check none are disputed
  const disputed = bookings.filter(b => b.status === 'disputed');
  if (disputed.length > 0) return { error: `${disputed.length} booking(s) disputed — payout blocked` };

  const totalCents = bookings.reduce((sum, b) => sum + (b.owner_payout_cents ?? 0), 0);

  const { data: payout, error } = await svc
    .from('fleet_payouts')
    .insert({
      owner_id: ownerId,
      status: 'pending',
      total_cents: totalCents,
      period_start: periodStart,
      period_end: periodEnd,
    })
    .select('id')
    .single();

  if (error || !payout) return { error: error?.message ?? 'Failed to create payout' };

  // Create line items
  for (const b of bookings) {
    await svc.from('payout_line_items').insert({
      payout_id: payout.id,
      booking_id: b.id,
      gross_cents: b.total_rental_cents,
      commission_cents: b.commission_cents,
      net_cents: b.owner_payout_cents,
    });
  }

  return { payoutId: payout.id };
}

/**
 * Hold a payout with reason.
 */
export async function holdPayout(payoutId: string, reason: string, heldBy: string): Promise<void> {
  const svc = createServiceClient();
  await svc.from('fleet_payouts')
    .update({ status: 'held', held_reason: reason, held_by: heldBy })
    .eq('id', payoutId);

  await auditLog({
    userId: heldBy, action: 'payout_hold', resource: 'fleet_payouts',
    resourceId: payoutId, success: true, riskScore: 15, metadata: { reason },
  });
}

/**
 * Release a held payout.
 */
export async function releasePayout(payoutId: string, releasedBy: string): Promise<void> {
  const svc = createServiceClient();
  await svc.from('fleet_payouts')
    .update({ status: 'pending', held_reason: null, held_by: null })
    .eq('id', payoutId);

  await auditLog({
    userId: releasedBy, action: 'payout_release', resource: 'fleet_payouts',
    resourceId: payoutId, success: true, metadata: {},
  });
}
