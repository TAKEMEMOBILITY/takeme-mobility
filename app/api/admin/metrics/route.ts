import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/admin/metrics — Time-series data for dashboard charts
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const svc = createServiceClient();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  try {
    const [
      hourlyRides,
      dailyPayments,
      todayRides,
      todayCompleted,
      todayCancelled,
      todayCompletedDurations,
      totalDrivers,
      nonOfflineDrivers,
    ] = await Promise.all([
      // Rides in last 24h for hourly chart
      svc.from('rides')
        .select('requested_at')
        .gte('requested_at', twentyFourHoursAgo)
        .eq('status', 'completed'),

      // Payments in last 7 days for daily revenue chart
      svc.from('payments')
        .select('amount, captured_at')
        .eq('status', 'captured')
        .gte('captured_at', sevenDaysAgo),

      // Total rides requested today
      svc.from('rides')
        .select('*', { count: 'exact', head: true })
        .gte('requested_at', todayStart),

      // Completed rides today
      svc.from('rides')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('trip_completed_at', todayStart),

      // Cancelled rides today
      svc.from('rides')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('requested_at', todayStart),

      // Completed rides today with duration for avg ETA
      svc.from('rides')
        .select('duration_min')
        .eq('status', 'completed')
        .gte('trip_completed_at', todayStart)
        .not('duration_min', 'is', null),

      // Total drivers
      svc.from('drivers')
        .select('*', { count: 'exact', head: true }),

      // Non-offline drivers (active/utilized)
      svc.from('drivers')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'offline'),
    ]);

    // Group rides by hour for last 24h
    const hourlyMap = new Map<string, number>();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
      hourlyMap.set(key, 0);
    }
    for (const ride of hourlyRides.data ?? []) {
      const d = new Date(ride.requested_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
      if (hourlyMap.has(key)) {
        hourlyMap.set(key, (hourlyMap.get(key) ?? 0) + 1);
      }
    }
    const hourly = Array.from(hourlyMap.entries()).map(([hour, rides]) => ({
      hour,
      label: hour.split(' ')[1],
      rides,
    }));

    // Group payments by day for last 7 days
    const dailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyMap.set(key, 0);
    }
    for (const payment of dailyPayments.data ?? []) {
      const d = new Date(payment.captured_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + Number(payment.amount));
      }
    }
    const dailyRevenue = Array.from(dailyMap.entries()).map(([date, revenue]) => {
      const parts = date.split('-');
      const dayLabel = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return { date, label: dayLabel, revenue: Math.round(revenue * 100) / 100 };
    });

    // Compute rates
    const totalToday = todayRides.count ?? 0;
    const completedCount = todayCompleted.count ?? 0;
    const cancelledCount = todayCancelled.count ?? 0;
    const matchRate = totalToday > 0 ? Math.round((completedCount / totalToday) * 1000) / 10 : 0;
    const cancelRate = totalToday > 0 ? Math.round((cancelledCount / totalToday) * 1000) / 10 : 0;

    const durations = (todayCompletedDurations.data ?? []).map(r => Number(r.duration_min)).filter(v => !isNaN(v) && v > 0);
    const avgEta = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10 : 0;

    const total = totalDrivers.count ?? 0;
    const nonOffline = nonOfflineDrivers.count ?? 0;
    const driverUtilization = total > 0 ? Math.round((nonOffline / total) * 1000) / 10 : 0;

    return NextResponse.json({
      hourly,
      dailyRevenue,
      rates: {
        matchRate,
        cancelRate,
        avgEta,
        driverUtilization,
      },
    });
  } catch (err) {
    console.error('[admin/metrics]', err);
    return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 });
  }
}
