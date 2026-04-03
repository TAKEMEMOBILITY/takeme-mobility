import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/permissions';
import { auditLog } from '@/lib/auth/audit';
import { setShadowMode, getAllShadowStatuses } from '@/lib/invariants/shadowMode';

// GET — list all invariants with shadow status
export async function GET() {
  const statuses = await getAllShadowStatuses();
  return NextResponse.json({ statuses });
}

// POST — toggle shadow mode for an invariant (ops_core+ only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const { allowed } = await requireRole(user.id, ['ops_core', 'exec_founder', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const { invariant, enabled } = await request.json() as { invariant: string; enabled: boolean };
  await setShadowMode(invariant, enabled);

  await auditLog({
    userId: user.id, userEmail: user.email,
    action: enabled ? 'shadow_mode_enable' : 'shadow_mode_disable',
    resource: 'invariants', resourceId: invariant,
    success: true, request, riskScore: 10,
    metadata: { invariant, enabled },
  });

  return NextResponse.json({ ok: true, invariant, enabled });
}
