import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/permissions';
import { auditLog } from '@/lib/auth/audit';

// GET — list users with roles
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });
  const { allowed } = await requireRole(user.id, ['security_owner', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const svc = createServiceClient();
  const { data } = await svc
    .from('riders')
    .select('id, email, full_name, role, mfa_enabled, locked_until, last_active_at, failed_attempts, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return NextResponse.json(data ?? []);
}

// PATCH — update user role, lock/unlock, force MFA reset
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });
  const { allowed } = await requireRole(user.id, ['security_owner', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const { userId, action: act, role: newRole, lockHours } = await request.json() as {
    userId: string;
    action: 'change_role' | 'lock' | 'unlock' | 'force_mfa_reset';
    role?: string;
    lockHours?: number;
  };

  const svc = createServiceClient();

  if (act === 'change_role' && newRole) {
    await svc.from('riders').update({ role: newRole }).eq('id', userId);
    await auditLog({
      userId: user.id, userEmail: user.email, action: 'change_user_role',
      resource: 'riders', resourceId: userId, success: true, request,
      riskScore: 30, metadata: { newRole },
    });
  } else if (act === 'lock') {
    const until = new Date(Date.now() + (lockHours ?? 24) * 3_600_000).toISOString();
    await svc.from('riders').update({ locked_until: until }).eq('id', userId);
    // Revoke all sessions
    await svc.from('secure_sessions').update({ revoked: true, revoke_reason: 'admin_lock' })
      .eq('user_id', userId).eq('revoked', false);
    await auditLog({
      userId: user.id, userEmail: user.email, action: 'lock_account',
      resource: 'riders', resourceId: userId, success: true, request,
      riskScore: 30, metadata: { lockHours },
    });
  } else if (act === 'unlock') {
    await svc.from('riders').update({ locked_until: null, failed_attempts: 0 }).eq('id', userId);
    await auditLog({
      userId: user.id, userEmail: user.email, action: 'unlock_account',
      resource: 'riders', resourceId: userId, success: true, request, riskScore: 20,
    });
  } else if (act === 'force_mfa_reset') {
    await svc.from('riders').update({ mfa_enabled: false }).eq('id', userId);
    await auditLog({
      userId: user.id, userEmail: user.email, action: 'force_mfa_reset',
      resource: 'riders', resourceId: userId, success: true, request, riskScore: 30,
    });
  }

  return NextResponse.json({ ok: true });
}
