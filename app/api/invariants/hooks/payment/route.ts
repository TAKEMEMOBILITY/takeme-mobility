import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { emitViolation } from '@/lib/invariants/eventBus';

// POST /api/invariants/hooks/payment — Supabase webhook on payment_audit_log INSERT
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const record = body.record ?? body;
  if (!record?.ride_id) return NextResponse.json({ ok: true });

  const svc = createServiceClient();

  // Check: already succeeded for this ride?
  const { data: existing } = await svc
    .from('payment_audit_log')
    .select('id')
    .eq('ride_id', record.ride_id)
    .eq('status', 'succeeded')
    .neq('id', record.id ?? '')
    .limit(1);

  if (existing && existing.length > 0 && record.status !== 'duplicate_blocked') {
    await emitViolation({
      invariant: 'payments', priority: 'CRITICAL',
      violation: `Duplicate payment for ride ${record.ride_id} — already succeeded`,
      context: { ride_id: record.ride_id, amount: record.amount, existingId: existing[0].id },
      timestamp: new Date().toISOString(), autoResolved: false,
    });
  }

  // Check: duplicate idempotency key
  if (record.idempotency_key) {
    const { data: dupes } = await svc
      .from('payment_audit_log')
      .select('id')
      .eq('idempotency_key', record.idempotency_key)
      .neq('id', record.id ?? '')
      .limit(1);

    if (dupes && dupes.length > 0) {
      await emitViolation({
        invariant: 'payments', priority: 'CRITICAL',
        violation: `Duplicate idempotency key: ${record.idempotency_key}`,
        context: { ride_id: record.ride_id, idempotency_key: record.idempotency_key },
        timestamp: new Date().toISOString(), autoResolved: false,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
