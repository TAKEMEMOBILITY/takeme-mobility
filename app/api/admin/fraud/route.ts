import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { banDevice } from '@/lib/fraud';

// GET /api/admin/fraud — Fraud events + stats for admin dashboard
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const svc = createServiceClient();

  const [recentEvents, highScoreTrips, bannedDevices, stats] = await Promise.all([
    // Recent fraud events
    svc.from('fraud_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    // High-score trips
    svc.from('trip_fraud_scores')
      .select('*')
      .eq('flagged', true)
      .order('created_at', { ascending: false })
      .limit(20),
    // Banned devices count
    svc.from('device_bans').select('*', { count: 'exact', head: true }),
    // Stats
    Promise.all([
      svc.from('fraud_events').select('*', { count: 'exact', head: true }).eq('severity', 'critical'),
      svc.from('fraud_events').select('*', { count: 'exact', head: true }).eq('severity', 'high'),
      svc.from('trip_fraud_scores').select('*', { count: 'exact', head: true }).eq('auto_cancelled', true),
    ]),
  ]);

  return NextResponse.json({
    events: recentEvents.data ?? [],
    flaggedTrips: highScoreTrips.data ?? [],
    bannedDeviceCount: bannedDevices.count ?? 0,
    stats: {
      criticalEvents: stats[0].count ?? 0,
      highEvents: stats[1].count ?? 0,
      autoCancelled: stats[2].count ?? 0,
    },
  });
}

// POST /api/admin/fraud — Ban device or dismiss alert
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();

    if (body.action === 'ban_device') {
      await banDevice(body.fingerprint, body.reason ?? 'Admin banned', body.userId, body.ip);
      return NextResponse.json({ banned: true });
    }

    if (body.action === 'dismiss') {
      const svc = createServiceClient();
      await svc.from('fraud_events')
        .update({ action_taken: 'dismissed' })
        .eq('id', body.eventId);
      return NextResponse.json({ dismissed: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
