import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/admin/audit — Paginated audit log
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const targetType = url.searchParams.get('target_type');
  const adminId = url.searchParams.get('admin_id');
  const adminEmail = url.searchParams.get('admin_email');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  const svc = createServiceClient();

  try {
    let query = svc
      .from('admin_audit_log')
      .select('id, admin_id, admin_email, action, target_type, target_id, details, ip_address, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) {
      query = query.eq('action', action);
    }
    if (targetType) {
      query = query.eq('target_type', targetType);
    }
    if (adminId) {
      query = query.eq('admin_id', adminId);
    }
    if (adminEmail) {
      query = query.ilike('admin_email', `%${adminEmail}%`);
    }
    if (from) {
      query = query.gte('created_at', from);
    }
    if (to) {
      query = query.lte('created_at', to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[admin/audit]', error);
      return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
    }

    return NextResponse.json({
      entries: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[admin/audit]', err);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
