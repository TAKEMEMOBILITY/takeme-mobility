import { createServiceClient } from '@/lib/supabase/service';
import { transitionBookingStatus } from './bookings';

// ═══════════════════════════════════════════════════════════════════════════
// Fleet Vehicle Handoff System
// Pickup + return checklists, condition tracking, fee triggers
// ═══════════════════════════════════════════════════════════════════════════

interface HandoffData {
  bookingId: string;
  batteryPct: number;
  odometer: number;
  exteriorCondition: 'good' | 'fair' | 'damaged';
  interiorCondition: 'good' | 'fair' | 'damaged';
  accessoriesPresent: string[];
  photos: string[];
  notes?: string;
}

export async function recordPickup(data: HandoffData, driverId: string): Promise<{ success: boolean; error?: string }> {
  const svc = createServiceClient();

  const { data: booking } = await svc
    .from('rental_bookings')
    .select('status')
    .eq('id', data.bookingId)
    .single();

  if (!booking || booking.status !== 'pickup_ready') {
    return { success: false, error: 'Booking not in pickup_ready state' };
  }

  await svc.from('vehicle_handoffs').insert({
    booking_id: data.bookingId,
    handoff_type: 'pickup',
    battery_pct: data.batteryPct,
    odometer: data.odometer,
    exterior_condition: data.exteriorCondition,
    interior_condition: data.interiorCondition,
    accessories_present: data.accessoriesPresent,
    photos: data.photos,
    notes: data.notes ?? null,
    confirmed_by_driver: true,
  });

  await transitionBookingStatus(data.bookingId, 'in_use', driverId, 'Pickup confirmed');
  return { success: true };
}

export async function recordReturn(
  data: HandoffData,
  driverId: string,
  scheduledEnd: string,
): Promise<{ success: boolean; fees?: { cleaning: number; late: number; damage: number; total: number } }> {
  const svc = createServiceClient();

  await svc.from('vehicle_handoffs').insert({
    booking_id: data.bookingId,
    handoff_type: 'return',
    battery_pct: data.batteryPct,
    odometer: data.odometer,
    exterior_condition: data.exteriorCondition,
    interior_condition: data.interiorCondition,
    accessories_present: data.accessoriesPresent,
    photos: data.photos,
    notes: data.notes ?? null,
    confirmed_by_driver: true,
  });

  // Calculate fees
  const now = new Date();
  const scheduled = new Date(scheduledEnd);
  const lateMinutes = Math.max(0, Math.floor((now.getTime() - scheduled.getTime()) / 60_000));
  const lateHours = Math.ceil(lateMinutes / 60);
  const lateFee = lateHours > 0 ? lateHours * 2500 : 0; // $25/hr
  const cleaningFee = data.interiorCondition === 'good' ? 0 : 7500; // $75
  const damageFee = data.exteriorCondition === 'damaged' ? 0 : 0; // Assessed separately
  const totalFees = lateFee + cleaningFee + damageFee;

  await svc.from('vehicle_return_reports').insert({
    booking_id: data.bookingId,
    cleanliness: data.interiorCondition === 'good' ? 'clean' : data.interiorCondition === 'fair' ? 'acceptable' : 'dirty',
    damage_found: data.exteriorCondition === 'damaged',
    charge_level_ok: data.batteryPct >= 20,
    late_return: lateMinutes > 0,
    late_minutes: lateMinutes,
    cleaning_fee_cents: cleaningFee,
    late_fee_cents: lateFee,
    damage_fee_cents: damageFee,
    total_extra_fees_cents: totalFees,
  });

  await transitionBookingStatus(data.bookingId, 'return_pending', driverId, 'Return submitted');
  return { success: true, fees: { cleaning: cleaningFee, late: lateFee, damage: damageFee, total: totalFees } };
}
