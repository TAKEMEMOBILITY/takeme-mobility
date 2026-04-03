import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkPermission, getUserRole } from '@/lib/auth/permissions';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/exec/dashboard — Executive dashboard data
// Auth: exec_founder or super_admin only
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const perm = await checkPermission(user.id, 'dashboard', 'read');
  if (!perm.allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const svc = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
  const prevWeekStart = new Date(now.getTime() - 14 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

  try {
    const [
      ridesToday,
      activeDrivers,
      revenueToday,
      newRidersToday,
      newDriversToday,
      avgRatingToday,
      // Growth
      ridesThisWeek,
      ridesPrevWeek,
      revenueThisWeek,
      revenuePrevWeek,
      totalRiders,
      totalDrivers,
      // 30-day revenue
      thirtyDayPayments,
      // Feed: recent rides
      recentCompletedRides,
      // Feed: recent driver signups
      recentDriverApps,
      // Feed: recent fraud
      recentFraud,
      // City ride counts
      seattleRides,
    ] = await Promise.all([
      // KPI: rides today
      svc.from('rides').select('*', { count: 'exact', head: true })
        .gte('requested_at', todayStart),
      // KPI: active drivers
      svc.from('drivers').select('*', { count: 'exact', head: true })
        .neq('status', 'offline'),
      // KPI: revenue today
      svc.from('payments').select('amount')
        .eq('status', 'captured').gte('captured_at', todayStart),
      // KPI: new riders today
      svc.from('riders').select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      // KPI: new drivers today
      svc.from('driver_applications').select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      // KPI: avg rating today
      svc.from('rides').select('driver_rating')
        .eq('status', 'completed').gte('trip_completed_at', todayStart)
        .not('driver_rating', 'is', null),
      // Growth: rides this week
      svc.from('rides').select('*', { count: 'exact', head: true })
        .eq('status', 'completed').gte('trip_completed_at', weekStart),
      // Growth: rides prev week
      svc.from('rides').select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('trip_completed_at', prevWeekStart).lt('trip_completed_at', weekStart),
      // Growth: revenue this week
      svc.from('payments').select('amount')
        .eq('status', 'captured').gte('captured_at', weekStart),
      // Growth: revenue prev week
      svc.from('payments').select('amount')
        .eq('status', 'captured')
        .gte('captured_at', prevWeekStart).lt('captured_at', weekStart),
      // Growth: total riders
      svc.from('riders').select('*', { count: 'exact', head: true }),
      // Growth: total drivers
      svc.from('drivers').select('*', { count: 'exact', head: true }),
      // 30-day revenue chart
      svc.from('payments').select('amount, captured_at')
        .eq('status', 'captured').gte('captured_at', thirtyDaysAgo),
      // Feed: recent completed rides
      svc.from('rides').select('id, pickup_address, final_fare, estimated_fare, trip_completed_at')
        .eq('status', 'completed')
        .order('trip_completed_at', { ascending: false }).limit(10),
      // Feed: recent driver applications
      svc.from('driver_applications').select('id, full_name, created_at')
        .order('created_at', { ascending: false }).limit(5),
      // Feed: recent fraud events
      svc.from('fraud_events').select('id, event_type, severity, created_at')
        .order('created_at', { ascending: false }).limit(5),
      // City: Seattle ride count
      svc.from('rides').select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),
    ]);

    const sumAmount = (data: { amount: number }[] | null) =>
      (data ?? []).reduce((s, p) => s + Number(p.amount), 0);

    const ratings = (avgRatingToday.data ?? []).map(r => Number(r.driver_rating)).filter(v => !isNaN(v));
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    const revWeek = sumAmount(revenueThisWeek.data);
    const revPrevWeek = sumAmount(revenuePrevWeek.data);
    const revenueGrowth = revPrevWeek > 0 ? Math.round(((revWeek - revPrevWeek) / revPrevWeek) * 1000) / 10 : 0;

    const ridesW = ridesThisWeek.count ?? 0;
    const ridesPW = ridesPrevWeek.count ?? 0;
    const rideGrowth = ridesPW > 0 ? Math.round(((ridesW - ridesPW) / ridesPW) * 1000) / 10 : 0;

    // 30-day revenue chart
    const dailyMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      dailyMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, 0);
    }
    for (const p of thirtyDayPayments.data ?? []) {
      const d = new Date(p.captured_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + Number(p.amount));
    }
    const revenueChart = Array.from(dailyMap.entries()).map(([date, revenue]) => {
      const parts = date.split('-');
      const label = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { date, label, revenue: Math.round(revenue * 100) / 100 };
    });

    const role = await getUserRole(user.id);

    return NextResponse.json({
      kpi: {
        ridesToday: ridesToday.count ?? 0,
        activeDrivers: activeDrivers.count ?? 0,
        revenueToday: Math.round(sumAmount(revenueToday.data) * 100) / 100,
        newSignupsToday: (newRidersToday.count ?? 0) + (newDriversToday.count ?? 0),
        avgRating,
      },
      growth: {
        rideGrowthWoW: rideGrowth,
        revenueGrowthWoW: revenueGrowth,
        totalRiders: totalRiders.count ?? 0,
        totalDrivers: totalDrivers.count ?? 0,
        ridesThisWeek: ridesW,
        ridesPrevWeek: ridesPW,
      },
      revenueChart,
      feed: {
        completedRides: (recentCompletedRides.data ?? []).map(r => ({
          id: r.id,
          city: 'Seattle',
          amount: Number(r.final_fare ?? r.estimated_fare ?? 0),
          time: r.trip_completed_at,
        })),
        driverSignups: (recentDriverApps.data ?? []).map(d => ({
          id: d.id,
          name: d.full_name,
          time: d.created_at,
        })),
        fraudFlags: (recentFraud.data ?? []).map(f => ({
          id: f.id,
          type: f.event_type,
          severity: f.severity,
          time: f.created_at,
        })),
      },
      cities: [
        { name: 'Seattle', status: 'live', rides: seattleRides.count ?? 0 },
        { name: 'Portland, OR', status: 'soon', rides: 0 },
        { name: 'San Francisco, CA', status: 'soon', rides: 0 },
        { name: 'Los Angeles, CA', status: 'soon', rides: 0 },
        { name: 'Austin, TX', status: 'soon', rides: 0 },
        { name: 'New York, NY', status: 'soon', rides: 0 },
      ],
      userRole: role,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('[exec/dashboard]', err);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
