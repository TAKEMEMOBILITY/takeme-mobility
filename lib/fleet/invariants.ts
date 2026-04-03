import { createServiceClient } from '@/lib/supabase/service';
import { hasExecutedContract } from './contracts';

// ═══════════════════════════════════════════════════════════════════════════
// Fleet Invariants — Non-negotiable system guarantees
// ═══════════════════════════════════════════════════════════════════════════

interface InvariantResult {
  name: string;
  passed: boolean;
  details: string;
}

/**
 * Verify all fleet invariants. Called by /api/invariants/check.
 */
export async function checkFleetInvariants(): Promise<InvariantResult[]> {
  const svc = createServiceClient();
  const results: InvariantResult[] = [];

  // INVARIANT: No active vehicle without executed master agreement
  try {
    const { data: activeVehicles } = await svc
      .from('fleet_vehicles')
      .select('id, owner_id')
      .eq('status', 'active');

    let violating = 0;
    for (const v of activeVehicles ?? []) {
      const hasMaster = await hasExecutedContract('master_agreement', v.owner_id);
      if (!hasMaster) violating++;
    }
    results.push({
      name: 'fleet:active_vehicle_requires_master_agreement',
      passed: violating === 0,
      details: violating > 0 ? `${violating} active vehicle(s) without executed master agreement` : 'All compliant',
    });
  } catch (e) {
    results.push({ name: 'fleet:active_vehicle_requires_master_agreement', passed: false, details: (e as Error).message });
  }

  // INVARIANT: No active vehicle without executed vehicle schedule
  try {
    const { data: activeVehicles } = await svc
      .from('fleet_vehicles')
      .select('id, owner_id')
      .eq('status', 'active');

    let violating = 0;
    for (const v of activeVehicles ?? []) {
      const hasSchedule = await hasExecutedContract('vehicle_schedule', v.owner_id, v.id);
      if (!hasSchedule) violating++;
    }
    results.push({
      name: 'fleet:active_vehicle_requires_vehicle_schedule',
      passed: violating === 0,
      details: violating > 0 ? `${violating} active vehicle(s) without executed vehicle schedule` : 'All compliant',
    });
  } catch (e) {
    results.push({ name: 'fleet:active_vehicle_requires_vehicle_schedule', passed: false, details: (e as Error).message });
  }

  // INVARIANT: No payout before completed booking
  try {
    const { data: payouts } = await svc
      .from('payout_line_items')
      .select('booking_id')
      .limit(100);

    let violating = 0;
    for (const p of payouts ?? []) {
      const { data: booking } = await svc.from('rental_bookings').select('status').eq('id', p.booking_id).single();
      if (booking && booking.status !== 'completed') violating++;
    }
    results.push({
      name: 'fleet:payout_requires_completed_booking',
      passed: violating === 0,
      details: violating > 0 ? `${violating} payout line(s) for non-completed bookings` : 'All compliant',
    });
  } catch (e) {
    results.push({ name: 'fleet:payout_requires_completed_booking', passed: false, details: (e as Error).message });
  }

  // INVARIANT: No double booking (same vehicle, overlapping dates)
  try {
    const { data: bookings } = await svc
      .from('rental_bookings')
      .select('id, vehicle_id, start_date, end_date')
      .not('status', 'in', '("cancelled","failed")')
      .order('vehicle_id')
      .order('start_date');

    let overlaps = 0;
    for (let i = 1; i < (bookings?.length ?? 0); i++) {
      const prev = bookings![i - 1];
      const curr = bookings![i];
      if (prev.vehicle_id === curr.vehicle_id && prev.end_date > curr.start_date) {
        overlaps++;
      }
    }
    results.push({
      name: 'fleet:no_double_booking',
      passed: overlaps === 0,
      details: overlaps > 0 ? `${overlaps} overlapping booking(s) detected` : 'No overlaps',
    });
  } catch (e) {
    results.push({ name: 'fleet:no_double_booking', passed: false, details: (e as Error).message });
  }

  // Log violations
  const violations = results.filter(r => !r.passed);
  if (violations.length > 0) {
    for (const v of violations) {
      await svc.from('fleet_invariant_violations').insert({
        invariant: v.name,
        priority: v.name.includes('payout') || v.name.includes('double_booking') ? 'CRITICAL' : 'HIGH',
        violation: v.details,
      });
    }
  }

  return results;
}
