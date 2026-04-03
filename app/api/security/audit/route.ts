import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';
import { requireRole } from '@/lib/auth/permissions';

// GET /api/security/audit — Fetch audit logs (security_owner + super_admin only)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const { allowed } = await requireRole(user.id, ['security_owner', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const svc = createServiceClient();
  const { data } = await svc
    .from('audit_logs')
    .select('id, user_email, user_role, action, resource, resource_id, ip_address, success, risk_score, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(200);

  return NextResponse.json(data ?? []);
}

// POST /api/security/audit — Log a client-side security event
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const body = await request.json();
  await auditLog({
    userId: user.id,
    userEmail: user.email,
    action: body.action ?? 'unknown',
    resource: 'security',
    success: true,
    request,
    riskScore: body.action === 'export_audit_csv' ? 25 : 0,
    metadata: body,
  });

  return NextResponse.json({ ok: true });
}
