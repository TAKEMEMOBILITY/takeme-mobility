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
  const { data: sessions } = await svc
    .from('secure_sessions')
    .select('*')
    .order('last_activity', { ascending: false })
    .limit(100);

  // Enrich with user email and role
  const userIds = [...new Set((sessions ?? []).map(s => s.user_id))];
  const { data: users } = userIds.length > 0
    ? await svc.from('riders').select('id, email, role').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  const enriched = (sessions ?? []).map(s => ({
    ...s,
    user_email: userMap.get(s.user_id)?.email ?? null,
    user_role: userMap.get(s.user_id)?.role ?? null,
  }));

  return NextResponse.json(enriched);
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

// PUT /api/security/sessions — Revoke all sessions for a user
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const { allowed } = await requireRole(user.id, ['security_owner', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const { userId, reason } = await request.json();

  const svc = createServiceClient();
  await svc
    .from('secure_sessions')
    .update({ revoked: true, revoke_reason: reason ?? 'admin_revoke_all' })
    .eq('user_id', userId)
    .eq('revoked', false);

  await auditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'revoke_all_sessions',
    resource: 'secure_sessions',
    resourceId: userId,
    success: true,
    request,
    riskScore: 25,
  });

  return NextResponse.json({ ok: true });
}
