import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/permissions';
import { auditLog } from '@/lib/auth/audit';

// ═══════════════════════════════════════════════════════════════════════════
// System Mode — NORMAL | DEGRADED | DEFENSIVE | LOCKDOWN
// Persisted in Upstash Redis key 'system:mode' with 24h TTL.
// ═══════════════════════════════════════════════════════════════════════════

const MODES = ['NORMAL', 'DEGRADED', 'DEFENSIVE', 'LOCKDOWN'] as const;
type Mode = typeof MODES[number];

function getRedisHeaders() {
  return { 'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN!}` };
}
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL!;

// GET — return current mode
export async function GET() {
  try {
    const res = await fetch(`${REDIS_URL}/get/system:mode`, { headers: getRedisHeaders() });
    const body = await res.json();
    return NextResponse.json({ mode: body.result ?? 'NORMAL' });
  } catch {
    return NextResponse.json({ mode: 'NORMAL' });
  }
}

// POST — change mode (ops_core+ only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const { allowed } = await requireRole(user.id, ['ops_core', 'exec_founder', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const { mode, reason } = await request.json() as { mode: string; reason?: string };
  if (!MODES.includes(mode as Mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  // Get previous mode
  let prevMode = 'NORMAL';
  try {
    const res = await fetch(`${REDIS_URL}/get/system:mode`, { headers: getRedisHeaders() });
    const body = await res.json();
    prevMode = body.result ?? 'NORMAL';
  } catch { /* default */ }

  // Set new mode with 24h TTL
  await fetch(`${REDIS_URL}/set/system:mode/${mode}/ex/86400`, { headers: getRedisHeaders() });

  await auditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'SYSTEM_MODE_CHANGE',
    resource: 'system_mode',
    success: true,
    request,
    riskScore: 20,
    metadata: { from: prevMode, to: mode, reason: reason ?? 'manual' },
  });

  // LOCKDOWN: revoke all non-super_admin sessions
  if (mode === 'LOCKDOWN') {
    const { createServiceClient } = await import('@/lib/supabase/service');
    const svc = createServiceClient();

    // Get super_admin user IDs to exclude
    const { data: superAdmins } = await svc.from('riders').select('id').eq('role', 'super_admin');
    const excludeIds = (superAdmins ?? []).map(u => u.id);

    // Revoke all other sessions
    const { data: sessions } = await svc.from('secure_sessions')
      .select('id, user_id')
      .eq('revoked', false);

    const toRevoke = (sessions ?? []).filter(s => !excludeIds.includes(s.user_id));
    if (toRevoke.length > 0) {
      await svc.from('secure_sessions')
        .update({ revoked: true, revoke_reason: 'LOCKDOWN' })
        .in('id', toRevoke.map(s => s.id));
    }

    await auditLog({
      userId: user.id, userEmail: user.email,
      action: 'LOCKDOWN_SESSION_PURGE', resource: 'secure_sessions',
      success: true, request, riskScore: 40,
      metadata: { revokedCount: toRevoke.length },
    });
  }

  return NextResponse.json({ mode, previous: prevMode });
}
