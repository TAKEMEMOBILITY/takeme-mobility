'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const RevenueBarChart = dynamic(
  () => import('./_charts').then(m => m.RevenueBarChart),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-[13px] text-[#86868b]">Loading chart...</div> },
);

// ═══════════════════════════════════════════════════════════════════════════
// /exec/dashboard — Executive Dashboard
//
// Auth: exec_founder, super_admin (enforced by proxy.ts + API)
// Watermarked via layout.tsx
// ═══════════════════════════════════════════════════════════════════════════

interface KPI { ridesToday: number; activeDrivers: number; revenueToday: number; newSignupsToday: number; avgRating: number; }
interface Growth { rideGrowthWoW: number; revenueGrowthWoW: number; totalRiders: number; totalDrivers: number; ridesThisWeek: number; ridesPrevWeek: number; }
interface ChartPoint { date: string; label: string; revenue: number; }
interface City { name: string; status: string; rides: number; }
interface FeedRide { id: string; city: string; amount: number; time: string; }
interface FeedDriver { id: string; name: string; time: string; }
interface FeedFraud { id: string; type: string; severity: string; time: string; }
interface DashData {
  kpi: KPI; growth: Growth; revenueChart: ChartPoint[];
  feed: { completedRides: FeedRide[]; driverSignups: FeedDriver[]; fraudFlags: FeedFraud[] };
  cities: City[]; timestamp: string;
}

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;
const ago = (iso: string) => {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
};

function GrowthBadge({ value }: { value: number }) {
  const color = value > 0 ? 'text-emerald-400 bg-emerald-500/10' : value < 0 ? 'text-red-400 bg-red-500/10' : 'text-[#86868b] bg-[#d2d2d7]';
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${color}`}>{pct(value)}</span>;
}

export default function ExecDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/exec/dashboard');
      if (res.status === 401 || res.status === 403) { setError('Access denied'); setLoading(false); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch { setError('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (loading) return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1D6AE5] border-t-transparent" />
    </div>
  );
  if (error) return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <p className="text-red-400 text-[14px]">{error}</p>
    </div>
  );
  if (!data) return null;

  const { kpi, growth, revenueChart, feed, cities } = data;

  return (
    <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Executive Dashboard</h1>
          <p className="mt-1 text-[13px] text-[#86868b]">
            Updated {data.timestamp ? ago(data.timestamp) : '...'} · Auto-refresh 15s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-[12px] font-medium text-emerald-400">Live</span>
          </div>
        </div>
      </div>

      {/* ═══ SECTION 1 — KPI Cards ════════════════════════════════════ */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPICard label="Rides Today" value={kpi.ridesToday} icon="🚗" />
        <KPICard label="Active Drivers" value={kpi.activeDrivers} icon="🟢" />
        <KPICard label="Revenue Today" value={usd(kpi.revenueToday)} icon="💰" accent="emerald" />
        <KPICard label="New Signups" value={kpi.newSignupsToday} icon="👤" />
        <KPICard label="Avg Rating" value={kpi.avgRating > 0 ? `${kpi.avgRating} ★` : '—'} icon="⭐" />
      </div>

      {/* ═══ SECTION 2 — Revenue Chart ════════════════════════════════ */}
      <div className="mb-8 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Revenue (30 Days)</h2>
            <p className="mt-1 text-[12px] text-[#86868b]">
              WoW growth: <GrowthBadge value={growth.revenueGrowthWoW} />
            </p>
          </div>
        </div>
        <div className="h-[280px] w-full">
          <RevenueBarChart data={revenueChart} />
        </div>
      </div>

      {/* ═══ SECTION 3 — Growth + Section 5 — Cities ═════════════════ */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Growth Metrics */}
        <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-6">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Growth Metrics</h2>
          <div className="mt-6 space-y-4">
            <GrowthRow label="Ride Growth (WoW)" value={growth.rideGrowthWoW} detail={`${growth.ridesThisWeek} this week vs ${growth.ridesPrevWeek} last week`} />
            <GrowthRow label="Revenue Growth (WoW)" value={growth.revenueGrowthWoW} detail="Captured payments comparison" />
            <div className="flex items-center justify-between border-t border-[#d2d2d7] pt-4">
              <span className="text-[13px] text-[#6e6e73]">Total Riders</span>
              <span className="text-[15px] font-bold text-[#1d1d1f]">{growth.totalRiders.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#6e6e73]">Total Drivers</span>
              <span className="text-[15px] font-bold text-[#1d1d1f]">{growth.totalDrivers.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#6e6e73]">Cities Active / Planned</span>
              <span className="text-[15px] font-bold text-[#1d1d1f]">
                {cities.filter(c => c.status === 'live').length} / {cities.length}
              </span>
            </div>
          </div>
        </div>

        {/* City Expansion */}
        <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-6">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">City Expansion</h2>
          <div className="mt-6 space-y-3">
            {cities.map(city => (
              <div key={city.name} className="flex items-center justify-between rounded-lg bg-[#FFFFFF] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${city.status === 'live' ? 'bg-emerald-400' : 'bg-[#86868b]'}`} />
                  <span className="text-[13px] font-medium text-[#1d1d1f]">{city.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {city.status === 'live' && city.rides > 0 && (
                    <span className="text-[12px] tabular-nums text-[#86868b]">{city.rides.toLocaleString()} rides</span>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    city.status === 'live' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#d2d2d7] text-[#86868b]'
                  }`}>
                    {city.status === 'live' ? 'LIVE' : 'SOON'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SECTION 4 — Live Activity Feed ═══════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Completed Rides */}
        <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Recent Rides</h3>
          <div className="mt-4 space-y-2">
            {feed.completedRides.length > 0 ? feed.completedRides.map(r => (
              <div key={r.id} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-[#6e6e73]">{r.city}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-[#1d1d1f] tabular-nums">{usd(r.amount)}</span>
                  <span className="text-[11px] text-[#86868b]">{ago(r.time)}</span>
                </div>
              </div>
            )) : <p className="text-[13px] text-[#86868b]">No completed rides yet</p>}
          </div>
        </div>

        {/* Driver Signups */}
        <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Driver Signups</h3>
          <div className="mt-4 space-y-2">
            {feed.driverSignups.length > 0 ? feed.driverSignups.map(d => (
              <div key={d.id} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">+</span>
                  <span className="text-[#6e6e73]">{d.name}</span>
                </div>
                <span className="text-[11px] text-[#86868b]">{ago(d.time)}</span>
              </div>
            )) : <p className="text-[13px] text-[#86868b]">No recent signups</p>}
          </div>
        </div>

        {/* Fraud Flags */}
        <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Fraud Flags</h3>
          <div className="mt-4 space-y-2">
            {feed.fraudFlags.length > 0 ? feed.fraudFlags.map(f => (
              <div key={f.id} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className={f.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}>⚠</span>
                  <span className="text-[#6e6e73]">{f.type.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    f.severity === 'critical' ? 'bg-red-500/10 text-red-400'
                    : f.severity === 'high' ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-[#d2d2d7] text-[#86868b]'
                  }`}>{f.severity}</span>
                  <span className="text-[11px] text-[#86868b]">{ago(f.time)}</span>
                </div>
              </div>
            )) : <p className="text-[13px] text-[#86868b]">No fraud flags</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function KPICard({ label, value, icon, accent }: { label: string; value: number | string; icon: string; accent?: string }) {
  const textColor = accent === 'emerald' ? 'text-emerald-400' : 'text-[#1d1d1f]';
  return (
    <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">{label}</span>
        <span className="text-[16px]">{icon}</span>
      </div>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${textColor}`}>{value}</p>
    </div>
  );
}

function GrowthRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[#6e6e73]">{label}</span>
        <GrowthBadge value={value} />
      </div>
      <p className="mt-0.5 text-[11px] text-[#86868b]">{detail}</p>
    </div>
  );
}
