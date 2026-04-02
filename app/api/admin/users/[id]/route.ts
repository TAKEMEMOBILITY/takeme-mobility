import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/lib/admin-audit';

// GET /api/admin/users/[id] — Full user (rider) profile
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const svc = createServiceClient();

  try {
    const [rider, rides, fraudEvents] = await Promise.all([
      svc.from('riders')
        .select('id, full_name, email, phone, rating, total_rides, is_admin, stripe_customer_id, created_at')
        .eq('id', id)
        .single(),

      svc.from('rides')
        .select('id, status, pickup_address, dropoff_address, estimated_fare, final_fare, vehicle_class, distance_km, duration_min, requested_at, trip_completed_at, rider_rating, driver_rating, assigned_driver_id, surge_multiplier, cancel_reason, cancelled_by')
        .eq('rider_id', id)
        .order('requested_at', { ascending: false })
        .limit(50),

      svc.from('fraud_events')
        .select('id, event_type, severity, fraud_score, action_taken, details, created_at, ride_id')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (rider.error || !rider.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: rider.data,
      rides: rides.data ?? [],
      fraudEvents: fraudEvents.data ?? [],
    });
  } catch (err) {
    console.error('[admin/users/id]', err);
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }
}

// POST /api/admin/users/[id] — User actions (suspend, add_note, ban_device)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const { action, note, reason } = body;
  const svc = createServiceClient();

  try {
    switch (action) {
      case 'suspend': {
        // Insert a fraud_event marking admin suspension
        await svc.from('fraud_events').insert({
          user_id: id,
          event_type: 'admin_suspension',
          severity: 'critical',
          fraud_score: 100,
          action_taken: 'account_suspended',
          details: {
            reason: reason || 'Admin suspended account',
            suspended_by: auth.user.email,
            suspended_at: new Date().toISOString(),
          },
        });

        await logAdminAction({
          adminId: auth.user.id,
          adminEmail: auth.user.email,
          action: 'suspend_user',
          targetType: 'rider',
          targetId: id,
          details: { reason: reason || 'Admin suspended account' },
        });

        return NextResponse.json({ success: true, message: 'User suspended' });
      }

      case 'add_note': {
        if (!note || typeof note !== 'string') {
          return NextResponse.json({ error: 'Note text is required' }, { status: 400 });
        }

        await svc.from('fraud_events').insert({
          user_id: id,
          event_type: 'admin_note',
          severity: 'low',
          fraud_score: 0,
          action_taken: 'none',
          details: {
            note,
            added_by: auth.user.email,
            added_at: new Date().toISOString(),
          },
        });

        await logAdminAction({
          adminId: auth.user.id,
          adminEmail: auth.user.email,
          action: 'add_user_note',
          targetType: 'rider',
          targetId: id,
          details: { note },
        });

        return NextResponse.json({ success: true, message: 'Note added' });
      }

      case 'ban_device': {
        // Look up device fingerprint from account_identifiers
        const { data: identifiers } = await svc
          .from('account_identifiers')
          .select('device_fingerprint')
          .eq('user_id', id)
          .limit(1)
          .maybeSingle();

        const fingerprint = identifiers?.device_fingerprint ?? null;

        await svc.from('fraud_events').insert({
          user_id: id,
          event_type: 'device_ban',
          severity: 'critical',
          fraud_score: 100,
          action_taken: 'permanent_ban',
          details: {
            device_fingerprint: fingerprint,
            reason: reason || 'Admin banned device',
            banned_by: auth.user.email,
            banned_at: new Date().toISOString(),
          },
        });

        await logAdminAction({
          adminId: auth.user.id,
          adminEmail: auth.user.email,
          action: 'ban_device',
          targetType: 'rider',
          targetId: id,
          details: { device_fingerprint: fingerprint, reason: reason || 'Admin banned device' },
        });

        return NextResponse.json({ success: true, message: 'Device banned', fingerprint });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[admin/users/id/action]', err);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
