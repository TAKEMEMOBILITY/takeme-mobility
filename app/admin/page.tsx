'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import chart components to avoid SSR issues with recharts
const RidesPerHourChart = dynamic(
  () => import('./_charts').then(m => m.RidesPerHourChart),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-[#71717a]">Loading chart...</div> }
);
const RevenueChart = dynamic(
  () => import('./_charts').then(m => m.RevenueChart),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-[#71717a]">Loading chart...</div> }
);

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME ADMIN DASHBOARD — Phase 3
// Real-time metrics, charts, activity feed. Auto-refreshes every 10 seconds.
// ═══════════════════════════════════════════════════════════════════════════

interface DashboardData {
  metrics: {
    activeRides: number;
    completedToday: number;
    completedWeek: number;
    completedMonth: number;
    totalDrivers: number;
    availableDrivers: number;
    onlineDrivers: number;
    totalRiders: number;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
  };
  dispatch: { queueLength: number; dlqLength: number; pendingApplications: number };
  activeRides: Array<{
    id: string; status: string; pickup_address: string; dropoff_address: string;
    estimated_fare: number; assigned_driver_id: string | null; requested_at: string;
  }>;
  recentRides: Array<{
    id: string; status: string; pickup_address: string; dropoff_address: string;
    estimated_fare: number; final_fare: number | null; vehicle_class: string;
    requested_at: string; trip_completed_at: string | null;
  }>;
  pendingApplications: Array<{
    id: string; full_name: string; phone: string; email: string;
    status: string; created_at: string;
  }>;
  timestamp: string;
}

interface MetricsData {
  hourly: Array<{ hour: string; label: string; rides: number }>;
  dailyRevenue: Array<{ date: string; label: string; revenue: number }>;
  rates: {
    matchRate: number;
    cancelRate: number;
    avgEta: number;
    driverUtilization: number;
  };
}

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ago = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
};

const STATUS_COLORS: Record<string, string> = {
  searching_driver: 'text-amber-400 bg-amber-400/10',
  driver_assigned: 'text-blue-400 bg-blue-400/10',
  driver_arriving: 'text-violet-400 bg-violet-400/10',
  arrived: 'text-indigo-400 bg-indigo-400/10',
  in_progress: 'text-emerald-400 bg-emerald-400/10',
  completed: 'text-emerald-500 bg-emerald-500/10',
  cancelled: 'text-red-400 bg-red-400/10',
  pending: 'text-amber-400 bg-amber-400/10',
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, metricsRes] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/metrics'),
      ]);

      if (dashRes.status === 401 || dashRes.status === 403) {
        setError('Admin access required. Please sign in with an admin account.');
        setLoading(false);
        return;
      }
      if (!dashRes.ok) throw new Error(`Dashboard HTTP ${dashRes.status}`);

      const dashJson = await dashRes.json();
      setData(dashJson);

      if (metricsRes.ok) {
        const metricsJson = await metricsRes.json();
        setMetrics(metricsJson);
      }

      setError('');
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-[#71717a]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-8 py-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const m = data.metrics;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#e4e4e7]">Dashboard</h1>
            <p className="mt-1 text-xs text-[#71717a]">
              Last updated {data.timestamp ? ago(data.timestamp) : '...'} -- Auto-refreshes every 10s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
          </div>
        </div>

        {/* ── Top Metric Cards (4x2 grid) ────────────────────────────── */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard
            label="Active Rides"
            value={m.activeRides}
            icon={<RideIcon />}
            accent="emerald"
          />
          <MetricCard
            label="Completed Today"
            value={m.completedToday}
            icon={<CheckIcon />}
            accent="blue"
          />
          <MetricCard
            label="Online Drivers"
            value={m.onlineDrivers}
            icon={<DriverIcon />}
            accent="violet"
          />
          <MetricCard
            label="Available Drivers"
            value={m.availableDrivers}
            icon={<AvailableIcon />}
            accent="cyan"
          />
          <MetricCard
            label="Revenue Today"
            value={usd(m.revenueToday)}
            icon={<DollarIcon />}
            accent="emerald"
          />
          <MetricCard
            label="Revenue This Week"
            value={usd(m.revenueWeek)}
            icon={<DollarIcon />}
            accent="blue"
          />
          <MetricCard
            label="Revenue This Month"
            value={usd(m.revenueMonth)}
            icon={<DollarIcon />}
            accent="amber"
          />
          <MetricCard
            label="DLQ Depth"
            value={data.dispatch.dlqLength}
            icon={<AlertIcon />}
            accent={data.dispatch.dlqLength > 0 ? 'red' : 'emerald'}
            alert={data.dispatch.dlqLength > 0}
          />
        </div>

        {/* ── Charts Row ─────────────────────────────────────────────── */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Rides per hour chart */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <h3 className="mb-4 text-sm font-semibold text-[#e4e4e7]">Rides Per Hour (24h)</h3>
            <div className="h-[250px] w-full">
              <RidesPerHourChart data={metrics?.hourly ?? []} />
            </div>
          </div>

          {/* Revenue chart */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <h3 className="mb-4 text-sm font-semibold text-[#e4e4e7]">Revenue (7 Days)</h3>
            <div className="h-[250px] w-full">
              <RevenueChart data={metrics?.dailyRevenue ?? []} />
            </div>
          </div>
        </div>

        {/* ── Stats Row ──────────────────────────────────────────────── */}
        {metrics?.rates && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Match Rate"
              value={`${metrics.rates.matchRate}%`}
              description="Completed / requested today"
              color={metrics.rates.matchRate >= 70 ? 'text-emerald-400' : metrics.rates.matchRate >= 40 ? 'text-amber-400' : 'text-red-400'}
            />
            <StatCard
              label="Cancel Rate"
              value={`${metrics.rates.cancelRate}%`}
              description="Cancelled / requested today"
              color={metrics.rates.cancelRate <= 10 ? 'text-emerald-400' : metrics.rates.cancelRate <= 25 ? 'text-amber-400' : 'text-red-400'}
            />
            <StatCard
              label="Avg Duration"
              value={`${metrics.rates.avgEta} min`}
              description="Average completed ride duration"
              color="text-blue-400"
            />
            <StatCard
              label="Driver Utilization"
              value={`${metrics.rates.driverUtilization}%`}
              description="Non-offline / total drivers"
              color={metrics.rates.driverUtilization >= 50 ? 'text-emerald-400' : 'text-amber-400'}
            />
          </div>
        )}

        {/* ── Recent Activity ────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Rides (2/3 width) */}
          <div className="lg:col-span-2 rounded-xl border border-[#1e1e2e] bg-[#0f0f17] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#1e1e2e] px-5 py-4">
              <h3 className="text-sm font-semibold text-[#e4e4e7]">Recent Rides</h3>
              <Link
                href="/admin/rides"
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    {['Status', 'Pickup', 'Dropoff', 'Class', 'Fare', 'When'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#71717a]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recentRides.slice(0, 10).map(r => (
                    <tr
                      key={r.id}
                      className="border-b border-[#1e1e2e]/50 transition-colors hover:bg-[#1e1e2e]/30"
                    >
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa] max-w-[140px] truncate">
                        {r.pickup_address}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa] max-w-[140px] truncate">
                        {r.dropoff_address}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa] capitalize">
                        {r.vehicle_class}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-[#e4e4e7]">
                        {usd(Number(r.final_fare ?? r.estimated_fare))}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#71717a]">
                        {ago(r.requested_at)}
                      </td>
                    </tr>
                  ))}
                  {data.recentRides.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#71717a]">
                        No recent rides
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Driver Applications (1/3 width) */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#1e1e2e] px-5 py-4">
              <h3 className="text-sm font-semibold text-[#e4e4e7]">Pending Applications</h3>
              <Link
                href="/admin/drivers"
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-[#1e1e2e]/50">
              {data.pendingApplications.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[#71717a]">
                  No pending applications
                </div>
              ) : (
                data.pendingApplications.slice(0, 8).map(app => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[#1e1e2e]/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#e4e4e7]">{app.full_name}</p>
                      <p className="text-xs text-[#71717a]">{app.email}</p>
                    </div>
                    <span className="text-xs text-[#71717a]">{ago(app.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  accent,
  alert,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: 'emerald' | 'blue' | 'violet' | 'cyan' | 'amber' | 'red';
  alert?: boolean;
}) {
  const accentMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
  };
  const textColor = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    violet: 'text-violet-400',
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };

  return (
    <div
      className={`rounded-xl border bg-[#0f0f17] p-4 transition-colors ${
        alert ? 'border-red-500/30 bg-red-500/5' : 'border-[#1e1e2e]'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
          {label}
        </span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${accentMap[accent]}`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold ${textColor[accent]}`}>{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  color,
}: {
  label: string;
  value: string;
  description: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">{label}</p>
      <p className={`mt-2 text-xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[#52525b]">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes = STATUS_COLORS[status] ?? 'text-[#71717a] bg-[#71717a]/10';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${classes}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function RideIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h.008M21 14.25h-5.625m0 0h-3.75" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DriverIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
    </svg>
  );
}

function AvailableIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
