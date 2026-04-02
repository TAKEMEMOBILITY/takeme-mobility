'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME ADMIN — Rides Management
// Filterable rides table with slide-in detail panel.
// ═══════════════════════════════════════════════════════════════════════════

interface Ride {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  vehicle_class: string;
  distance_km: number;
  duration_min: number;
  estimated_fare: number;
  final_fare: number | null;
  surge_multiplier: number;
  cancel_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  requested_at: string;
  driver_assigned_at: string | null;
  driver_arrived_at: string | null;
  trip_started_at: string | null;
  trip_completed_at: string | null;
  rider_name: string | null;
  rider_email: string | null;
  rider_phone: string | null;
  driver_name: string | null;
  driver_email: string | null;
  assigned_driver_id: string | null;
  rider_id: string;
}

interface RideDetail {
  ride: Ride & {
    rider_rating: number | null;
    driver_rating: number | null;
    route_polyline: string | null;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_lat: number;
    dropoff_lng: number;
  };
  rider: { id: string; full_name: string; email: string; phone: string; rating: number; total_rides: number } | null;
  driver: { id: string; full_name: string; email: string; phone: string; avatar_url: string; rating: number; total_trips: number; status: string } | null;
  vehicle: { id: string; vehicle_class: string; make: string; model: string; year: number; color: string; plate_number: string } | null;
  payment: { id: string; amount: number; currency: string; status: string; payment_method_type: string; stripe_payment_intent: string } | null;
  events: Array<{
    id: string;
    event_type: string;
    old_status: string | null;
    new_status: string | null;
    actor: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  fraud_score: { score: number; checks: Record<string, unknown>; flagged: boolean; auto_cancelled: boolean } | null;
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400',
  quoted: 'bg-amber-500/15 text-amber-400',
  searching_driver: 'bg-amber-500/15 text-amber-400',
  driver_assigned: 'bg-blue-500/15 text-blue-400',
  driver_arriving: 'bg-violet-500/15 text-violet-400',
  arrived: 'bg-indigo-500/15 text-indigo-400',
  in_progress: 'bg-emerald-500/15 text-emerald-400',
  completed: 'bg-green-500/15 text-green-400',
  cancelled: 'bg-red-500/15 text-red-400',
};

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function timeAgo(iso: string | null) {
  if (!iso) return '--';
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
    second: '2-digit',
  });
}

export default function AdminRidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<string>('all');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Detail panel
  const [detail, setDetail] = useState<RideDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const fetchRides = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('status', tab);
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const res = await fetch(`/api/admin/rides?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRides(data.rides ?? []);
      setTotal(data.total ?? 0);
      setError('');
    } catch {
      setError('Failed to load rides');
    } finally {
      setLoading(false);
    }
  }, [tab, offset]);

  useEffect(() => {
    setLoading(true);
    setOffset(0);
    fetchRides();
  }, [tab]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const openDetail = async (rideId: string) => {
    setPanelOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/rides/${rideId}`);
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
        fetchRides();
        if (detail) openDetail(detail.ride.id);
      }
    } catch {
      alert('Action failed');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 overflow-y-auto p-6 transition-all ${panelOpen ? 'mr-[480px]' : ''}`}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#e4e4e7]">Rides</h1>
          <p className="text-sm text-[#71717a] mt-1">{total} rides total</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#13131b] rounded-xl p-1 w-fit border border-[#1e1e2e]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-[#1e1e2e] text-white'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-[#13131b] rounded-xl border border-[#1e1e2e] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#71717a]">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#71717a] border-t-emerald-500 mr-3" />
              Loading rides...
            </div>
          ) : rides.length === 0 ? (
            <div className="py-20 text-center text-[#52525b] text-sm">No rides found</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['ID', 'Status', 'Pickup', 'Dropoff', 'Fare', 'Driver', 'Requested'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52525b]"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rides.map((ride) => (
                  <tr
                    key={ride.id}
                    onClick={() => openDetail(ride.id)}
                    className="border-b border-[#1e1e2e]/50 cursor-pointer transition-colors hover:bg-[#1e1e2e]/30"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-[#71717a]">
                      {ride.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          STATUS_CLASSES[ride.status] ?? 'bg-zinc-500/15 text-zinc-400'
                        }`}
                      >
                        {ride.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa] max-w-[180px] truncate">
                      {ride.pickup_address}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa] max-w-[180px] truncate">
                      {ride.dropoff_address}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-[#e4e4e7]">
                      {usd(Number(ride.final_fare ?? ride.estimated_fare))}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa]">
                      {ride.driver_name ?? '--'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#52525b]">
                      {timeAgo(ride.requested_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-[#52525b]">
              Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#13131b] border border-[#1e1e2e] text-[#a1a1aa] disabled:opacity-30 hover:bg-[#1e1e2e] transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#13131b] border border-[#1e1e2e] text-[#a1a1aa] disabled:opacity-30 hover:bg-[#1e1e2e] transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-in detail panel */}
      {panelOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-[#0f0f17] border-l border-[#1e1e2e] overflow-y-auto z-50 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1e1e2e] bg-[#0f0f17] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#e4e4e7]">Ride Detail</h2>
              {detail && (
                <span className="font-mono text-[10px] text-[#52525b]">{detail.ride.id}</span>
              )}
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#1e1e2e] text-[#71717a] hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-20 text-[#71717a]">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#71717a] border-t-emerald-500 mr-3" />
              Loading...
            </div>
          ) : detail ? (
            <div className="p-5 space-y-5">
              {/* Status + actions */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_CLASSES[detail.ride.status] ?? 'bg-zinc-500/15 text-zinc-400'
                  }`}
                >
                  {detail.ride.status.replace(/_/g, ' ')}
                </span>
                <div className="flex gap-2">
                  {!['completed', 'cancelled'].includes(detail.ride.status) && (
                    <button
                      onClick={() => performAction('cancel_ride', detail.ride.id, 'Admin cancelled')}
                      disabled={actionLoading === 'cancel_ride'}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === 'cancel_ride' ? '...' : 'Cancel Ride'}
                    </button>
                  )}
                  {detail.ride.status === 'completed' && (
                    <button
                      onClick={() => performAction('refund_ride', detail.ride.id)}
                      disabled={actionLoading === 'refund_ride'}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === 'refund_ride' ? '...' : 'Refund'}
                    </button>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <Card title="Timeline">
                <div className="space-y-0">
                  <TimelineStep
                    label="Requested"
                    time={detail.ride.requested_at}
                    active={!!detail.ride.requested_at}
                    isLast={false}
                  />
                  <TimelineStep
                    label="Driver Assigned"
                    time={detail.ride.driver_assigned_at}
                    active={!!detail.ride.driver_assigned_at}
                    isLast={false}
                  />
                  <TimelineStep
                    label="Driver Arrived"
                    time={detail.ride.driver_arrived_at}
                    active={!!detail.ride.driver_arrived_at}
                    isLast={false}
                  />
                  <TimelineStep
                    label="Trip Started"
                    time={detail.ride.trip_started_at}
                    active={!!detail.ride.trip_started_at}
                    isLast={false}
                  />
                  <TimelineStep
                    label={detail.ride.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                    time={detail.ride.status === 'cancelled' ? detail.ride.cancelled_at : detail.ride.trip_completed_at}
                    active={detail.ride.status === 'completed' || detail.ride.status === 'cancelled'}
                    isLast={true}
                    variant={detail.ride.status === 'cancelled' ? 'error' : 'success'}
                  />
                </div>
              </Card>

              {/* Fare breakdown */}
              <Card title="Fare">
                <div className="space-y-2">
                  <Row label="Estimated" value={usd(Number(detail.ride.estimated_fare))} />
                  {detail.ride.final_fare != null && (
                    <Row label="Final" value={usd(Number(detail.ride.final_fare))} highlight />
                  )}
                  {detail.ride.surge_multiplier > 1 && (
                    <Row
                      label="Surge"
                      value={`${detail.ride.surge_multiplier}x`}
                      className="text-amber-400"
                    />
                  )}
                  {detail.ride.distance_km && (
                    <Row label="Distance" value={`${Number(detail.ride.distance_km).toFixed(1)} km`} />
                  )}
                  {detail.ride.duration_min && (
                    <Row label="Duration" value={`${Math.round(Number(detail.ride.duration_min))} min`} />
                  )}
                  {detail.ride.vehicle_class && (
                    <Row label="Class" value={detail.ride.vehicle_class} />
                  )}
                </div>
              </Card>

              {/* Payment */}
              {detail.payment && (
                <Card title="Payment">
                  <div className="space-y-2">
                    <Row label="Amount" value={`${detail.payment.currency?.toUpperCase()} ${usd(Number(detail.payment.amount))}`} />
                    <Row label="Status" value={detail.payment.status} />
                    <Row label="Method" value={detail.payment.payment_method_type ?? '--'} />
                  </div>
                </Card>
              )}

              {/* Driver card */}
              {detail.driver && (
                <Card title="Driver">
                  <div className="space-y-2">
                    <Row label="Name" value={detail.driver.full_name} />
                    <Row label="Email" value={detail.driver.email} />
                    <Row label="Rating" value={`${Number(detail.driver.rating).toFixed(1)} / 5`} />
                    <Row label="Total Trips" value={String(detail.driver.total_trips)} />
                    {detail.vehicle && (
                      <Row
                        label="Vehicle"
                        value={`${detail.vehicle.color} ${detail.vehicle.year} ${detail.vehicle.make} ${detail.vehicle.model} (${detail.vehicle.plate_number})`}
                      />
                    )}
                  </div>
                </Card>
              )}

              {/* Rider card */}
              {detail.rider && (
                <Card title="Rider">
                  <div className="space-y-2">
                    <Row label="Name" value={detail.rider.full_name} />
                    <Row label="Email" value={detail.rider.email} />
                    <Row label="Phone" value={detail.rider.phone ?? '--'} />
                    <Row label="Rating" value={detail.rider.rating ? `${Number(detail.rider.rating).toFixed(1)} / 5` : 'N/A'} />
                    <Row label="Total Rides" value={String(detail.rider.total_rides)} />
                  </div>
                </Card>
              )}

              {/* Fraud score */}
              {detail.fraud_score && (
                <Card title="Fraud Score">
                  <div className="space-y-2">
                    <Row
                      label="Score"
                      value={String(detail.fraud_score.score)}
                      className={detail.fraud_score.flagged ? 'text-red-400' : 'text-emerald-400'}
                    />
                    <Row label="Flagged" value={detail.fraud_score.flagged ? 'Yes' : 'No'} />
                    <Row label="Auto-cancelled" value={detail.fraud_score.auto_cancelled ? 'Yes' : 'No'} />
                    {detail.fraud_score.checks && (
                      <div className="mt-2 p-2 rounded-lg bg-[#0a0a0f] text-[10px] font-mono text-[#52525b] overflow-x-auto">
                        {JSON.stringify(detail.fraud_score.checks, null, 2)}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Event log */}
              {detail.events.length > 0 && (
                <Card title="Event Log">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1e1e2e]">
                          <th className="pb-2 text-left text-[10px] font-semibold text-[#52525b] uppercase">Event</th>
                          <th className="pb-2 text-left text-[10px] font-semibold text-[#52525b] uppercase">Actor</th>
                          <th className="pb-2 text-left text-[10px] font-semibold text-[#52525b] uppercase">Status</th>
                          <th className="pb-2 text-left text-[10px] font-semibold text-[#52525b] uppercase">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.events.map((e) => (
                          <tr key={e.id} className="border-b border-[#1e1e2e]/30">
                            <td className="py-2 text-[#a1a1aa]">{e.event_type}</td>
                            <td className="py-2 text-[#71717a]">{e.actor}</td>
                            <td className="py-2">
                              {e.new_status ? (
                                <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_CLASSES[e.new_status] ?? 'bg-zinc-500/15 text-zinc-400'}`}>
                                  {e.new_status.replace(/_/g, ' ')}
                                </span>
                              ) : (
                                <span className="text-[#52525b]">--</span>
                              )}
                            </td>
                            <td className="py-2 text-[#52525b] whitespace-nowrap">{fmtTime(e.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Cancel info */}
              {detail.ride.cancel_reason && (
                <Card title="Cancellation">
                  <div className="space-y-2">
                    <Row label="Reason" value={detail.ride.cancel_reason} />
                    <Row label="Cancelled by" value={detail.ride.cancelled_by ?? '--'} />
                    <Row label="At" value={fmtTime(detail.ride.cancelled_at)} />
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-[#52525b] text-sm">
              Failed to load ride detail
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
    <div className="bg-[#13131b] rounded-xl border border-[#1e1e2e] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  className,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#71717a]">{label}</span>
      <span className={`${highlight ? 'font-semibold text-[#e4e4e7]' : 'text-[#a1a1aa]'} ${className ?? ''}`}>
        {value}
      </span>
    </div>
  );
}

function TimelineStep({
  label,
  time,
  active,
  isLast,
  variant,
}: {
  label: string;
  time: string | null;
  active: boolean;
  isLast: boolean;
  variant?: 'success' | 'error';
}) {
  let dotColor = 'bg-[#2a2a3e]';
  if (active) {
    if (variant === 'error') dotColor = 'bg-red-500';
    else if (variant === 'success') dotColor = 'bg-emerald-500';
    else dotColor = 'bg-blue-500';
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full ${dotColor} shrink-0 mt-0.5`} />
        {!isLast && (
          <div className={`w-px flex-1 min-h-[28px] ${active ? 'bg-[#2a2a3e]' : 'bg-[#1e1e2e]'}`} />
        )}
      </div>
      <div className="pb-4">
        <p className={`text-xs font-medium ${active ? 'text-[#e4e4e7]' : 'text-[#52525b]'}`}>
          {label}
        </p>
        <p className="text-[10px] text-[#52525b] mt-0.5">{time ? fmtTime(time) : 'Pending'}</p>
      </div>
    </div>
  );
}
