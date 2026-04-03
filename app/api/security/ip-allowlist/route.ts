import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/permissions';
import { auditLog } from '@/lib/auth/audit';

// GET — list all IP allowlist entries + recent access IPs
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });
  const { allowed } = await requireRole(user.id, ['security_owner', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const svc = createServiceClient();
  const twentyFourHoursAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [entries, recentIPs] = await Promise.all([
    svc.from('ip_allowlist').select('*').order('created_at', { ascending: false }),
    svc.from('audit_logs')
      .select('ip_address')
      .in('resource', ['/ops', '/security', '/ops/', '/security/'])
      .gte('created_at', twentyFourHoursAgo)
      .eq('success', true),
  ]);

  const uniqueIPs = [...new Set((recentIPs.data ?? []).map(r => r.ip_address).filter(Boolean))];

  return NextResponse.json({ entries: entries.data ?? [], recentAccessIPs: uniqueIPs });
}

// POST — add new IP/CIDR entry
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });
  const { allowed } = await requireRole(user.id, ['security_owner', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const { ip_cidr, description, allowed_roles } = await request.json();
  const svc = createServiceClient();

  await svc.from('ip_allowlist').insert({
    ip_cidr,
    description: description ?? null,
    allowed_roles: allowed_roles ?? null,
    created_by: user.id,
  });

  await auditLog({
    userId: user.id, userEmail: user.email, action: 'add_ip_allowlist',
    resource: 'ip_allowlist', success: true, request, riskScore: 20,
    metadata: { ip_cidr, description },
  });

  return NextResponse.json({ ok: true });
}

// DELETE — remove IP entry
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });
  const { allowed } = await requireRole(user.id, ['security_owner', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const { id } = await request.json();
  const svc = createServiceClient();
  await svc.from('ip_allowlist').delete().eq('id', id);

  await auditLog({
    userId: user.id, userEmail: user.email, action: 'delete_ip_allowlist',
    resource: 'ip_allowlist', resourceId: id, success: true, request, riskScore: 30,
  });

  return NextResponse.json({ ok: true });
}
