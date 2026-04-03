import { NextResponse } from 'next/server';

// POST /api/invariants/hooks/audit — Supabase webhook on audit_logs INSERT
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const record = body.record ?? body;
  if (!record) return NextResponse.json({ ok: true });

  // Check: risk_score > 90 → trigger reaction engine immediately
  if (record.risk_score && record.risk_score > 90) {
    try {
      const { react } = await import('@/lib/security/reactionEngine');
      react(record.user_id, record.risk_score, {
        action: record.action,
        resource: record.resource,
        userEmail: record.user_email,
        ip: record.ip_address,
      }).catch(() => {});
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ ok: true });
}
