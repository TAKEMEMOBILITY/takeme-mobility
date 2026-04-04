'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME ADMIN — Drivers Management
// Filterable drivers table with search and slide-in detail panel.
// ═══════════════════════════════════════════════════════════════════════════

interface Driver {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  status: string;
  rating: number;
  total_trips: number;
  is_verified: boolean;
  is_active: boolean;
  accepts_pets: boolean;
  created_at: string;
  last_location_at: string | null;
  vehicle: {
    vehicle_class: string;
    make: string;
    model: string;
    year: number;
    color: string;
    plate_number: string;
  } | null;
}

interface DriverDetail {
  driver: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
    license_number: string;
    status: string;
    rating: number;
    total_trips: number;
    is_verified: boolean;
    is_active: boolean;
    accepts_pets: boolean;
    created_at: string;
    last_location_at: string | null;
  };
  vehicles: Array<{
    id: string;
    vehicle_class: string;
    make: string;
    model: string;
    year: number;
    color: string;
    plate_number: string;
    is_active: boolean;
  }>;
  recent_rides: Array<{
    id: string;
    status: string;
    pickup_address: string;
    dropoff_address: string;
    estimated_fare: number;
    final_fare: number | null;
    vehicle_class: string;
    requested_at: string;
    trip_completed_at: string | null;
    rider_name: string | null;
    rider_rating: number | null;
    driver_rating: number | null;
  }>;
  stats: {
    total_assigned: number;
    completed: number;
    cancelled: number;
    acceptance_rate: number;
    cancel_rate: number;
  };
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'busy', label: 'Busy' },
  { key: 'on_trip', label: 'On Trip' },
  { key: 'offline', label: 'Offline' },
] as const;

const STATUS_CLASSES: Record<string, string> = {
  available: 'bg-emerald-500/15 text-emerald-400',
  busy: 'bg-amber-500/15 text-amber-400',
  on_trip: 'bg-red-500/15 text-red-400',
  offline: 'bg-zinc-500/15 text-[#86868b]',
};

const RIDE_STATUS_CLASSES: Record<string, string> = {
  completed: 'bg-[#1D6AE5]/10 text-[#1D6AE5]',
  cancelled: 'bg-red-500/15 text-red-400',
  in_progress: 'bg-emerald-500/15 text-emerald-400',
  driver_assigned: 'bg-blue-500/15 text-blue-400',
  searching_driver: 'bg-amber-500/15 text-amber-400',
};

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function timeAgo(iso: string | null) {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

function fmtTime(iso: string | null) {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detail panel
  const [detail, setDetail] = useState<DriverDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const fetchDrivers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('status', tab);
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/drivers?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDrivers(data.drivers ?? []);
      setError('');
    } catch {
      setError('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    setLoading(true);
    fetchDrivers();
  }, [fetchDrivers]);

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
    }, 400);
  };

  const openDetail = async (driverId: string) => {
    setPanelOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/drivers/${driverId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const performAction = async (action: string, targetId: string, reason?: string) => {
    setActionLoading(action);
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId, reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(`Action failed: ${d.error}`);
      } else {
        fetchDrivers();
        if (detail) openDetail(detail.driver.id);
      }
    } catch {
      alert('Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const driverCounts = {
    all: drivers.length,
    available: drivers.filter((d) => d.status === 'available').length,
    busy: drivers.filter((d) => d.status === 'busy').length,
    on_trip: drivers.filter((d) => d.status === 'on_trip').length,
    offline: drivers.filter((d) => d.status === 'offline').length,
  };

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 overflow-y-auto p-6 transition-all ${panelOpen ? 'mr-[480px]' : ''}`}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Drivers</h1>
          <p className="text-sm text-[#86868b] mt-1">{drivers.length} drivers</p>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <div className="flex gap-1 bg-[#f5f5f7] rounded-xl p-1 border border-[#d2d2d7]">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  tab === t.key
                    ? 'bg-[#d2d2d7] text-[#1d1d1f]'
                    : 'text-[#86868b] hover:text-[#6e6e73]'
                }`}
              >
                {t.label}
                {tab === 'all' && t.key !== 'all' && (
                  <span className="text-[10px] text-[#86868b]">{driverCounts[t.key]}</span>
                )}
              </button>
            ))}
          </div>

          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search name or email..."
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7] text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:border-[#d2d2d7] w-64"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-[#f5f5f7] rounded-xl border border-[#d2d2d7] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#86868b]">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#86868b] border-t-[#1D6AE5] mr-3" />
              Loading drivers...
            </div>
          ) : drivers.length === 0 ? (
            <div className="py-20 text-center text-[#86868b] text-sm">No drivers found</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#d2d2d7]">
                  {['Name', 'Status', 'Rating', 'Trips', 'Vehicle', 'Last Seen'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#86868b]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr
                    key={driver.id}
                    onClick={() => openDetail(driver.id)}
                    className="border-b border-[#d2d2d7]/50 cursor-pointer transition-colors hover:bg-[#d2d2d7]/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#d2d2d7] flex items-center justify-center text-xs font-semibold text-[#86868b]">
                          {driver.full_name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1d1d1f]">{driver.full_name}</p>
                          <p className="text-[10px] text-[#86868b]">{driver.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          STATUS_CLASSES[driver.status] ?? 'bg-zinc-500/15 text-[#86868b]'
                        }`}
                      >
                        {driver.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6e6e73]">
                      {driver.rating ? `${Number(driver.rating).toFixed(1)}` : '--'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6e6e73]">{driver.total_trips}</td>
                    <td className="px-4 py-3 text-xs text-[#86868b]">
                      {driver.vehicle
                        ? `${driver.vehicle.make} ${driver.vehicle.model}`
                        : '--'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#86868b]">
                      {timeAgo(driver.last_location_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Slide-in detail panel */}
      {panelOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-[#f5f5f7] border-l border-[#d2d2d7] overflow-y-auto z-50 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d2d2d7] bg-[#f5f5f7] px-5 py-4">
            <h2 className="text-base font-semibold text-[#1d1d1f]">Driver Detail</h2>
            <button
              onClick={() => setPanelOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#d2d2d7] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-20 text-[#86868b]">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#86868b] border-t-[#1D6AE5] mr-3" />
              Loading...
            </div>
          ) : detail ? (
            <div className="p-5 space-y-5">
              {/* Profile header */}
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-[#d2d2d7] flex items-center justify-center text-lg font-bold text-[#86868b]">
                  {detail.driver.full_name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#1d1d1f]">{detail.driver.full_name}</h3>
                  <p className="text-xs text-[#86868b]">{detail.driver.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        STATUS_CLASSES[detail.driver.status] ?? 'bg-zinc-500/15 text-[#86868b]'
                      }`}
                    >
                      {detail.driver.status.replace(/_/g, ' ')}
                    </span>
                    {!detail.driver.is_active && (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-500/15 text-red-400">
                        Suspended
                      </span>
                    )}
                    {detail.driver.is_verified && (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {detail.driver.is_active && (
                <button
                  onClick={() => performAction('suspend_driver', detail.driver.id, 'Admin suspended')}
                  disabled={actionLoading === 'suspend_driver'}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'suspend_driver' ? 'Suspending...' : 'Suspend Driver'}
                </button>
              )}

              {/* Stats */}
              <Card title="Stats">
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Rating" value={detail.driver.rating ? `${Number(detail.driver.rating).toFixed(1)} / 5` : 'N/A'} />
                  <StatBox label="Total Trips" value={String(detail.driver.total_trips)} />
                  <StatBox
                    label="Acceptance Rate"
                    value={`${detail.stats.acceptance_rate}%`}
                    color={detail.stats.acceptance_rate >= 80 ? 'text-emerald-400' : detail.stats.acceptance_rate >= 50 ? 'text-amber-400' : 'text-red-400'}
                  />
                  <StatBox
                    label="Cancel Rate"
                    value={`${detail.stats.cancel_rate}%`}
                    color={detail.stats.cancel_rate <= 10 ? 'text-emerald-400' : detail.stats.cancel_rate <= 25 ? 'text-amber-400' : 'text-red-400'}
                  />
                </div>
              </Card>

              {/* Info */}
              <Card title="Information">
                <div className="space-y-2">
                  <InfoRow label="Phone" value={detail.driver.phone ?? '--'} />
                  <InfoRow label="License" value={detail.driver.license_number ?? '--'} />
                  <InfoRow label="Last Seen" value={timeAgo(detail.driver.last_location_at)} />
                  <InfoRow label="Joined" value={fmtTime(detail.driver.created_at)} />
                  <InfoRow label="Accepts Pets" value={detail.driver.accepts_pets ? 'Yes' : 'No'} />
                </div>
              </Card>

              {/* Vehicles */}
              {detail.vehicles.length > 0 && (
                <Card title="Vehicles">
                  <div className="space-y-3">
                    {detail.vehicles.map((v) => (
                      <div
                        key={v.id}
                        className={`p-3 rounded-lg border ${
                          v.is_active
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-[#d2d2d7] bg-[#FFFFFF]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-[#1d1d1f]">
                            {v.color} {v.year} {v.make} {v.model}
                          </span>
                          {v.is_active && (
                            <span className="text-[9px] font-semibold text-emerald-400 uppercase">Active</span>
                          )}
                        </div>
                        <div className="flex gap-3 text-[10px] text-[#86868b]">
                          <span>Plate: {v.plate_number}</span>
                          <span>Class: {v.vehicle_class}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Recent rides */}
              {detail.recent_rides.length > 0 && (
                <Card title={`Recent Rides (${detail.recent_rides.length})`}>
                  <div className="space-y-2">
                    {detail.recent_rides.map((ride) => (
                      <div
                        key={ride.id}
                        className="p-3 rounded-lg bg-[#FFFFFF] border border-[#d2d2d7]/50"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                              RIDE_STATUS_CLASSES[ride.status] ?? 'bg-zinc-500/15 text-[#86868b]'
                            }`}
                          >
                            {ride.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-[#86868b]">{timeAgo(ride.requested_at)}</span>
                        </div>
                        <p className="text-[11px] text-[#6e6e73] truncate">
                          {ride.pickup_address?.slice(0, 30)} → {ride.dropoff_address?.slice(0, 30)}
                        </p>
                        <div className="flex gap-3 mt-1 text-[10px] text-[#86868b]">
                          <span>Fare: {usd(Number(ride.final_fare ?? ride.estimated_fare))}</span>
                          {ride.rider_name && <span>Rider: {ride.rider_name}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-[#86868b] text-sm">
              Failed to load driver detail
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#f5f5f7] rounded-xl border border-[#d2d2d7] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#86868b]">{label}</span>
      <span className="text-[#6e6e73]">{value}</span>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-[#FFFFFF] border border-[#d2d2d7]/50 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b] mb-1">
        {label}
      </p>
      <p className={`text-lg font-bold ${color ?? 'text-[#1d1d1f]'}`}>{value}</p>
    </div>
  );
}
