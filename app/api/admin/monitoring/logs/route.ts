import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/monitoring/logs
//
// Returns last 20 unique monitoring log entries for the dashboard.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('monitoring_logs')
      .select('id, service, status, latency_ms, error, created_at')
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
