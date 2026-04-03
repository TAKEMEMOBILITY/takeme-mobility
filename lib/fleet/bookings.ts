import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';
import { checkDriverEligibility } from './eligibility';

// ═══════════════════════════════════════════════════════════════════════════
// Fleet Booking Engine
// Availability check, lock, checkout, deposit, lifecycle management
// ═══════════════════════════════════════════════════════════════════════════

const COMMISSION_RATE = 0.20;

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const rh = () => ({ Authorization: `Bearer ${REDIS_TOKEN!}` });

interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  eligibility?: string;
}

/**
 * Check if vehicle is available for the requested date range.
 * No overlapping non-cancelled bookings allowed.
 */
export async function checkAvailability(
  vehicleId: string,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('rental_bookings')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .not('status', 'in', '("cancelled","failed")')
    .lt('start_date', endDate)
    .gt('end_date', startDate)
    .limit(1);
  return (data?.length ?? 0) === 0;
}

/**
 * One-click rental flow.
 * Checks eligibility → availability → lock → create booking → return checkout URL.
 */
export async function createRentalBooking(params: {
  vehicleId: string;
  driverId: string;
  startDate: string;
  endDate: string;
  idempotencyKey?: string;
}): Promise<BookingResult> {
  const svc = createServiceClient();
  const idemKey = params.idempotencyKey ?? `bk_${params.vehicleId}_${params.driverId}_${Date.now()}`;

  // Idempotency check
  const { data: existing } = await svc
    .from('rental_bookings')
    .select('id, status')
    .eq('idempotency_key', idemKey)
    .limit(1);

  if (existing && existing.length > 0) {
    return { success: true, bookingId: existing[0].id, error: 'Booking already exists' };
  }

  // 1. Check eligibility
  const eligibility = await checkDriverEligibility(params.driverId, params.vehicleId);
  if (eligibility.result === 'ineligible') {
    return { success: false, error: 'Not eligible for this vehicle', eligibility: eligibility.result };
  }

  // 2. Check availability
  const available = await checkAvailability(params.vehicleId, params.startDate, params.endDate);
  if (!available) {
    return { success: false, error: 'Vehicle not available for selected dates' };
  }

  // 3. Acquire booking lock (Redis NX, 5 min TTL)
  const lockKey = `booking:lock:${params.vehicleId}:${params.startDate}`;
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const res = await fetch(`${REDIS_URL}/set/${lockKey}/1/nx/ex/300`, { headers: rh() });
      const body = await res.json();
      if (body.result !== 'OK') {
        return { success: false, error: 'Another booking is being processed for this vehicle' };
      }
    } catch { /* Redis down — proceed with DB-level check */ }
  }

  // 4. Get vehicle details
  const { data: vehicle } = await svc
    .from('fleet_vehicles')
    .select('owner_id, daily_rate_cents, deposit_amount_cents')
    .eq('id', params.vehicleId)
    .eq('status', 'active')
    .single();

  if (!vehicle) {
    releaseLock(lockKey);
    return { success: false, error: 'Vehicle not found or not active' };
  }

  // 5. Calculate pricing
  const days = Math.max(1, Math.ceil(
    (new Date(params.endDate).getTime() - new Date(params.startDate).getTime()) / 86_400_000,
  ));
  const totalRental = vehicle.daily_rate_cents * days;
  const commission = Math.round(totalRental * COMMISSION_RATE);
  const ownerPayout = totalRental - commission;

  // 6. Create booking
  const { data: booking, error } = await svc
    .from('rental_bookings')
    .insert({
      vehicle_id: params.vehicleId,
      driver_id: params.driverId,
      owner_id: vehicle.owner_id,
      status: 'pending_checkout',
      start_date: params.startDate,
      end_date: params.endDate,
      daily_rate_cents: vehicle.daily_rate_cents,
      total_rental_cents: totalRental,
      commission_cents: commission,
      owner_payout_cents: ownerPayout,
      deposit_amount_cents: vehicle.deposit_amount_cents ?? 0,
      idempotency_key: idemKey,
    })
    .select('id')
    .single();

  if (error || !booking) {
    releaseLock(lockKey);
    return { success: false, error: error?.message ?? 'Failed to create booking' };
  }

  // 7. Log status history
  await logStatusChange(booking.id, undefined, 'pending_checkout', params.driverId);

  // 8. Create deposit record if needed
  if ((vehicle.deposit_amount_cents ?? 0) > 0) {
    await svc.from('security_deposits').insert({
      booking_id: booking.id,
      amount_cents: vehicle.deposit_amount_cents,
      status: 'pending',
    });
  }

  await auditLog({
    userId: params.driverId,
    action: 'rental_booking_created',
    resource: 'rental_bookings',
    resourceId: booking.id,
    success: true,
    metadata: { vehicleId: params.vehicleId, days, totalRental, commission },
  });

  releaseLock(lockKey);
  return { success: true, bookingId: booking.id };
}

/**
 * Transition booking status with validation and audit.
 */
export async function transitionBookingStatus(
  bookingId: string,
  newStatus: string,
  userId?: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  const svc = createServiceClient();

  const { data: booking } = await svc
    .from('rental_bookings')
    .select('status')
    .eq('id', bookingId)
    .single();

  if (!booking) return { success: false, error: 'Booking not found' };

  // Validate transition
  const validTransitions: Record<string, string[]> = {
    draft: ['pending_checkout', 'cancelled'],
    pending_checkout: ['deposit_pending', 'confirmed', 'cancelled', 'failed'],
    deposit_pending: ['confirmed', 'cancelled', 'failed'],
    confirmed: ['pickup_ready', 'cancelled'],
    pickup_ready: ['in_use', 'cancelled'],
    in_use: ['return_pending'],
    return_pending: ['completed', 'disputed'],
    completed: ['disputed'],
    disputed: ['completed'],
  };

  const allowed = validTransitions[booking.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return { success: false, error: `Cannot transition from ${booking.status} to ${newStatus}` };
  }

  const update: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
  if (newStatus === 'completed') update.completed_at = new Date().toISOString();
  if (newStatus === 'cancelled') {
    update.cancelled_at = new Date().toISOString();
    update.cancelled_by = userId ?? null;
    update.cancel_reason = reason ?? null;
  }

  await svc.from('rental_bookings').update(update).eq('id', bookingId);
  await logStatusChange(bookingId, booking.status, newStatus, userId, reason);

  return { success: true };
}

async function logStatusChange(
  bookingId: string, prev: string | undefined, next: string, userId?: string, reason?: string,
) {
  const svc = createServiceClient();
  await svc.from('rental_booking_status_history').insert({
    booking_id: bookingId,
    previous_status: prev ?? null,
    new_status: next,
    changed_by: userId ?? null,
    reason: reason ?? null,
  });
}

function releaseLock(key: string) {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  fetch(`${REDIS_URL}/del/${key}`, { headers: rh() }).catch(() => {});
}
