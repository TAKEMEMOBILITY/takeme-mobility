import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { emitViolation } from '@/lib/invariants/eventBus';

// POST /api/invariants/hooks/profile — Supabase webhook on riders UPDATE
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const record = body.record ?? body;
  const old = body.old_record ?? {};
  if (!record?.id) return NextResponse.json({ ok: true });

  const svc = createServiceClient();
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();

  // Check: is_admin changed without audit log
  if (old.is_admin === false && record.is_admin === true) {
    const { data: auditEntry } = await svc
      .from('audit_logs')
      .select('id')
      .eq('resource', 'riders')
      .eq('resource_id', record.id)
      .gte('created_at', oneMinAgo)
      .limit(1);

    if (!auditEntry || auditEntry.length === 0) {
      await emitViolation({
        invariant: 'contract', priority: 'CRITICAL',
        violation: `is_admin changed to true for ${record.email} without audit trail`,
        context: { userId: record.id, email: record.email },
        timestamp: new Date().toISOString(), autoResolved: false,
      });
    }
  }

  // Check: role changed without audit log
  if (old.role && record.role && old.role !== record.role) {
    const { data: auditEntry } = await svc
      .from('audit_logs')
      .select('id')
      .or(`action.eq.change_user_role,action.eq.change_role`)
      .gte('created_at', oneMinAgo)
      .limit(1);

    if (!auditEntry || auditEntry.length === 0) {
      await emitViolation({
        invariant: 'data', priority: 'HIGH',
        violation: `Role changed for ${record.email}: ${old.role} → ${record.role} without audit`,
        context: { userId: record.id, email: record.email, from: old.role, to: record.role },
        timestamp: new Date().toISOString(), autoResolved: false,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
