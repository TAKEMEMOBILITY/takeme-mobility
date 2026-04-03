import { NextResponse } from 'next/server';
import { emitViolation, emitNearMiss } from '@/lib/invariants/eventBus';

// POST /api/invariants/hooks/ride — Supabase webhook on rides UPDATE
const STATUS_ORDER = ['searching_driver', 'driver_assigned', 'driver_arriving', 'arrived', 'in_progress', 'completed', 'cancelled'];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const record = body.record ?? body;
  const old = body.old_record ?? {};
  if (!record?.id) return NextResponse.json({ ok: true });

  // Check: status went backward
  if (old.status && record.status) {
    const oldIdx = STATUS_ORDER.indexOf(old.status);
    const newIdx = STATUS_ORDER.indexOf(record.status);
    if (oldIdx >= 0 && newIdx >= 0 && newIdx < oldIdx && record.status !== 'cancelled') {
      await emitViolation({
        invariant: 'data', priority: 'HIGH',
        violation: `Ride ${record.id} status went backward: ${old.status} → ${record.status}`,
        context: { ride_id: record.id, from: old.status, to: record.status },
        timestamp: new Date().toISOString(), autoResolved: false,
      });
    }
  }

  // Check: driver changed on completed ride
  if (old.status === 'completed' && record.assigned_driver_id !== old.assigned_driver_id) {
    await emitViolation({
      invariant: 'data', priority: 'HIGH',
      violation: `Driver changed on completed ride ${record.id}`,
      context: { ride_id: record.id, oldDriver: old.assigned_driver_id, newDriver: record.assigned_driver_id },
      timestamp: new Date().toISOString(), autoResolved: false,
    });
  }

  // Check: ride active > 4 hours
  if (record.requested_at && ['searching_driver', 'driver_assigned', 'driver_arriving', 'arrived', 'in_progress'].includes(record.status)) {
    const age = Date.now() - new Date(record.requested_at).getTime();
    if (age > 4 * 3_600_000) {
      await emitNearMiss('data', `Ride ${record.id} active for ${Math.round(age / 3_600_000)}h`, { ride_id: record.id });
    }
  }

  return NextResponse.json({ ok: true });
}
