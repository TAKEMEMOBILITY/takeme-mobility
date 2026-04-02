import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/lib/admin-audit';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/drivers/[id] — Full driver detail
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const svc = createServiceClient();

  try {
    const [driverResult, vehiclesResult, recentRidesResult, walletResult, fraudResult, statsResult] = await Promise.all([
      // Driver info
      svc
        .from('drivers')
        .select(`
          *,
          driver_locations ( location, heading, speed_kmh, updated_at )
        `)
        .eq('id', id)
        .single(),
      // Vehicles
      svc
        .from('vehicles')
        .select('*')
        .eq('driver_id', id)
        .order('is_active', { ascending: false }),
      // Recent rides (last 20)
      svc
        .from('rides')
        .select(`
          id, status, pickup_address, dropoff_address,
          estimated_fare, final_fare, vehicle_class,
          requested_at, trip_completed_at, rider_rating, driver_rating,
          riders!rides_rider_id_fkey ( full_name )
        `)
        .eq('assigned_driver_id', id)
        .order('requested_at', { ascending: false })
        .limit(20),
      // Wallet
      svc
        .from('driver_wallets')
        .select('available, pending, lifetime, card_balance')
        .eq('driver_id', id)
        .maybeSingle(),
      // Fraud events
      svc
        .from('fraud_events')
        .select('id, event_type, severity, fraud_score, action_taken, details, created_at, ride_id')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      // Stats: completed vs cancelled (where this driver was assigned)
      Promise.all([
        svc
          .from('rides')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_driver_id', id)
          .eq('status', 'completed'),
        svc
          .from('rides')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_driver_id', id)
          .eq('status', 'cancelled'),
        svc
          .from('rides')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_driver_id', id),
      ]),
    ]);

    if (driverResult.error || !driverResult.data) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const driver = driverResult.data as Record<string, unknown>;
    const locations = driver.driver_locations as Record<string, unknown>[] | null;
    const location = locations?.[0] ?? null;

    const completedCount = statsResult[0].count ?? 0;
    const cancelledCount = statsResult[1].count ?? 0;
    const totalAssigned = statsResult[2].count ?? 0;

    const acceptanceRate = totalAssigned > 0
      ? Math.round((completedCount / totalAssigned) * 100)
      : 0;
    const cancelRate = totalAssigned > 0
      ? Math.round((cancelledCount / totalAssigned) * 100)
      : 0;

    const rides = (recentRidesResult.data ?? []).map((r: Record<string, unknown>) => {
      const rider = r.riders as Record<string, unknown> | null;
      return {
        ...r,
        rider_name: rider?.full_name ?? null,
        riders: undefined,
      };
    });

    return NextResponse.json({
      driver: {
        id: driver.id,
        auth_user_id: driver.auth_user_id,
        full_name: driver.full_name,
        email: driver.email,
        phone: driver.phone,
        avatar_url: driver.avatar_url,
        license_number: driver.license_number,
        status: driver.status,
        rating: driver.rating,
        total_trips: driver.total_trips,
        is_verified: driver.is_verified,
        is_active: driver.is_active,
        accepts_pets: driver.accepts_pets,
        created_at: driver.created_at,
        last_location_at: location?.updated_at ?? null,
      },
      wallet: walletResult.data ?? { available: 0, pending: 0, lifetime: 0, card_balance: 0 },
      vehicles: vehiclesResult.data ?? [],
      recent_rides: rides,
      fraudEvents: fraudResult.data ?? [],
      stats: {
        total_assigned: totalAssigned,
        completed: completedCount,
        cancelled: cancelledCount,
        acceptance_rate: acceptanceRate,
        cancel_rate: cancelRate,
      },
    });
  } catch (err) {
    console.error('[admin/drivers/id]', err);
    return NextResponse.json({ error: 'Failed to fetch driver detail' }, { status: 500 });
  }
}

// POST /api/admin/drivers/[id] — Driver actions (suspend, activate, add_note)
export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const body = await req.json();
  const { action, note, reason } = body;
  const svc = createServiceClient();

  try {
    switch (action) {
      case 'suspend': {
        await svc.from('drivers')
          .update({ is_active: false, status: 'offline' })
          .eq('id', id);

        await svc.from('fraud_events').insert({
          user_id: id,
          event_type: 'admin_suspension',
          severity: 'critical',
          fraud_score: 100,
          action_taken: 'driver_suspended',
          details: {
            reason: reason || 'Admin suspended driver',
            suspended_by: auth.user.email,
            suspended_at: new Date().toISOString(),
          },
        });

        await logAdminAction({
          adminId: auth.user.id,
          adminEmail: auth.user.email,
          action: 'suspend_driver',
          targetType: 'driver',
          targetId: id,
          details: { reason: reason || 'Admin suspended driver' },
        });

        return NextResponse.json({ success: true, message: 'Driver suspended' });
      }

      case 'activate': {
        await svc.from('drivers')
          .update({ is_active: true })
          .eq('id', id);

        await logAdminAction({
          adminId: auth.user.id,
          adminEmail: auth.user.email,
          action: 'activate_driver',
          targetType: 'driver',
          targetId: id,
          details: {},
        });

        return NextResponse.json({ success: true, message: 'Driver activated' });
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
          action: 'add_driver_note',
          targetType: 'driver',
          targetId: id,
          details: { note },
        });

        return NextResponse.json({ success: true, message: 'Note added' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[admin/drivers/id/action]', err);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
