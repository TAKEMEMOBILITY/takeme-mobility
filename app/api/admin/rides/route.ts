import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/admin/rides — List rides with filters
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = request.nextUrl;
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  const svc = createServiceClient();

  try {
    let query = svc
      .from('rides')
      .select(`
        id, status, pickup_address, pickup_lat, pickup_lng,
        dropoff_address, dropoff_lat, dropoff_lng,
        vehicle_class, distance_km, duration_min,
        estimated_fare, final_fare, surge_multiplier,
        cancel_reason, cancelled_by, cancelled_at,
        requested_at, driver_assigned_at, driver_arrived_at,
        trip_started_at, trip_completed_at,
        rider_id, assigned_driver_id,
        riders!rides_rider_id_fkey ( full_name, email, phone ),
        drivers!rides_assigned_driver_id_fkey ( full_name, email )
      `, { count: 'exact' })
      .order('requested_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      // Support grouped filters
      const activeStatuses = ['searching_driver', 'driver_assigned', 'driver_arriving', 'arrived', 'in_progress'];
      if (status === 'active') {
        query = query.in('status', activeStatuses);
      } else if (status === 'completed') {
        query = query.eq('status', 'completed');
      } else if (status === 'cancelled') {
        query = query.eq('status', 'cancelled');
      } else {
        query = query.eq('status', status);
      }
    }

    if (from) {
      query = query.gte('requested_at', new Date(from).toISOString());
    }
    if (to) {
      query = query.lte('requested_at', new Date(to).toISOString());
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[admin/rides]', error);
      return NextResponse.json({ error: 'Failed to fetch rides' }, { status: 500 });
    }

    // Flatten joined data for easier client consumption
    const rides = (data ?? []).map((r: Record<string, unknown>) => {
      const rider = r.riders as Record<string, unknown> | null;
      const driver = r.drivers as Record<string, unknown> | null;
      return {
        ...r,
        rider_name: rider?.full_name ?? null,
        rider_email: rider?.email ?? null,
        rider_phone: rider?.phone ?? null,
        driver_name: driver?.full_name ?? null,
        driver_email: driver?.email ?? null,
        riders: undefined,
        drivers: undefined,
      };
    });

    return NextResponse.json({ rides, total: count ?? 0, limit, offset });
  } catch (err) {
    console.error('[admin/rides]', err);
    return NextResponse.json({ error: 'Failed to fetch rides' }, { status: 500 });
  }
}
