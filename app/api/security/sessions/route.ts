import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/permissions';
import { auditLog } from '@/lib/auth/audit';

// GET /api/security/sessions — List all active sessions
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const { allowed } = await requireRole(user.id, ['security_owner', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const svc = createServiceClient();
  const { data } = await svc
    .from('secure_sessions')
    .select('*')
    .order('last_activity', { ascending: false })
    .limit(100);

  return NextResponse.json(data ?? []);
}

// DELETE /api/security/sessions — Revoke a session
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const { allowed } = await requireRole(user.id, ['security_owner', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const { sessionId, reason } = await request.json();

  const svc = createServiceClient();
  await svc
    .from('secure_sessions')
    .update({ revoked: true, revoke_reason: reason ?? 'admin_revoke' })
    .eq('id', sessionId);

  await auditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'revoke_session',
    resource: 'secure_sessions',
    resourceId: sessionId,
    success: true,
    request,
    riskScore: 15,
  });

  return NextResponse.json({ ok: true });
}
