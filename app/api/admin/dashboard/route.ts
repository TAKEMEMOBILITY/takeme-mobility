import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getDispatchQueueLength, getDLQLength, getOnlineDriverIds } from '@/lib/redis';

// GET /api/admin/dashboard — Full admin dashboard data
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const svc = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  try {
    const [
      activeRides,
      completedToday,
      completedWeek,
      completedMonth,
      totalDrivers,
      availableDrivers,
      totalRiders,
      pendingApplications,
      revenueToday,
      revenueWeek,
      revenueMonth,
      recentRides,
      recentApplications,
      queueLength,
      dlqLength,
    ] = await Promise.all([
      // Active rides
      svc.from('rides').select('id, status, pickup_address, dropoff_address, estimated_fare, assigned_driver_id, requested_at', { count: 'exact' })
        .in('status', ['searching_driver', 'driver_assigned', 'driver_arriving', 'arrived', 'in_progress'])
        .order('requested_at', { ascending: false }).limit(50),
      // Completed today
      svc.from('rides').select('*', { count: 'exact', head: true })
        .eq('status', 'completed').gte('trip_completed_at', todayStart),
      // Completed this week
      svc.from('rides').select('*', { count: 'exact', head: true })
        .eq('status', 'completed').gte('trip_completed_at', weekStart),
      // Completed this month
      svc.from('rides').select('*', { count: 'exact', head: true })
        .eq('status', 'completed').gte('trip_completed_at', monthStart),
      // Total drivers
      svc.from('drivers').select('*', { count: 'exact', head: true }),
      // Available drivers
      svc.from('drivers').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      // Total riders
      svc.from('riders').select('*', { count: 'exact', head: true }),
      // Pending applications
      svc.from('driver_applications').select('id, full_name, phone, email, status, created_at')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
      // Revenue today
      svc.from('payments').select('amount').eq('status', 'captured').gte('captured_at', todayStart),
      // Revenue week
      svc.from('payments').select('amount').eq('status', 'captured').gte('captured_at', weekStart),
      // Revenue month
      svc.from('payments').select('amount').eq('status', 'captured').gte('captured_at', monthStart),
      // Recent rides (last 20)
      svc.from('rides').select('id, status, pickup_address, dropoff_address, estimated_fare, final_fare, vehicle_class, requested_at, trip_completed_at')
        .order('requested_at', { ascending: false }).limit(20),
      // Recent applications
      svc.from('driver_applications').select('id, full_name, phone, email, vehicle_make, vehicle_model, status, created_at')
        .order('created_at', { ascending: false }).limit(20),
      // Dispatch queue
      getDispatchQueueLength().catch(() => 0),
      // DLQ
      getDLQLength().catch(() => 0),
    ]);

    // Calculate revenue sums
    const sumRevenue = (data: { amount: number }[] | null) =>
      (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

    // Get online driver count from Redis
    let onlineDriverCount = 0;
    try {
      const ids = await getOnlineDriverIds();
      onlineDriverCount = ids.length;
    } catch { /* Redis down */ }

    return NextResponse.json({
      metrics: {
        activeRides: activeRides.count ?? 0,
        completedToday: completedToday.count ?? 0,
        completedWeek: completedWeek.count ?? 0,
        completedMonth: completedMonth.count ?? 0,
        totalDrivers: totalDrivers.count ?? 0,
        availableDrivers: availableDrivers.count ?? 0,
        onlineDrivers: onlineDriverCount,
        totalRiders: totalRiders.count ?? 0,
        revenueToday: Math.round(sumRevenue(revenueToday.data) * 100) / 100,
        revenueWeek: Math.round(sumRevenue(revenueWeek.data) * 100) / 100,
        revenueMonth: Math.round(sumRevenue(revenueMonth.data) * 100) / 100,
      },
      dispatch: {
        queueLength,
        dlqLength,
        pendingApplications: pendingApplications.data?.length ?? 0,
      },
      activeRides: activeRides.data ?? [],
      recentRides: recentRides.data ?? [],
      pendingApplications: pendingApplications.data ?? [],
      recentApplications: recentApplications.data ?? [],
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('[admin/dashboard]', err);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
