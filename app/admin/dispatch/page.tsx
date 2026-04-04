'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────

interface DispatchDebug {
  ride: {
    id: string;
    rider_id: string;
    assigned_driver_id: string | null;
    status: string;
    pickup_address: string;
    dropoff_address: string;
    pickup_lat: number;
    pickup_lng: number;
    estimated_fare: number;
    final_fare: number | null;
    surge_multiplier: number;
    cancel_reason: string | null;
    cancelled_by: string | null;
    requested_at: string;
    trip_completed_at: string | null;
  };
  assignedDriver: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    status: string;
    rating: number;
    total_trips: number;
  } | null;
  dispatchEvents: RideEvent[];
  allEvents: RideEvent[];
  excludedDrivers: Array<{ id: string; full_name: string; email: string }>;
  currentOffer: string | null;
  nearbyDrivers: Array<{
    id: string;
    full_name: string;
    status: string;
    rating: number;
    distance_km: number;
    lat: number;
    lng: number;
  }>;
  escalationCount: number;
}

interface RideEvent {
  id: string;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  actor: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface RecentRide {
  id: string;
  status: string;
  pickup_address: string;
  requested_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const STATUS_COLORS: Record<string, string> = {
  searching_driver: 'bg-amber-500/20 text-amber-400',
  driver_assigned: 'bg-blue-500/20 text-blue-400',
  driver_arriving: 'bg-purple-500/20 text-purple-400',
  arrived: 'bg-indigo-500/20 text-indigo-400',
  in_progress: 'bg-emerald-500/20 text-emerald-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

// ── Component ────────────────────────────────────────────────────────────

export default function DispatchDebugPage() {
  const [rideId, setRideId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState<DispatchDebug | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentRides, setRecentRides] = useState<RecentRide[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // Fetch recent rides in searching/assigned states
  const fetchRecentRides = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) return;
      const dashboard = await res.json();
      setRecentRides(
        (dashboard.activeRides ?? []).filter(
          (r: RecentRide) =>
            r.status === 'searching_driver' || r.status === 'driver_assigned',
        ),
      );
    } catch {
      // silent
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentRides();
    const interval = setInterval(fetchRecentRides, 15000);
    return () => clearInterval(interval);
  }, [fetchRecentRides]);

  const fetchDispatch = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/admin/dispatch/${id}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? `HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json);
      setRideId(id);
    } catch {
      setError('Failed to fetch dispatch info');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed) fetchDispatch(trimmed);
  };

  // Extract candidate drivers from dispatch events metadata
  const candidateDrivers = data
    ? data.dispatchEvents
        .filter(
          (e) =>
            e.metadata &&
            (e.event_type.includes('offer') ||
              e.event_type.includes('assign') ||
              e.event_type.includes('timeout')),
        )
        .map((e) => ({
          eventType: e.event_type,
          driverId:
            (e.metadata?.driver_id as string) ??
            (e.metadata?.driverId as string) ??
            '',
          driverName:
            (e.metadata?.driver_name as string) ??
            (e.metadata?.driverName as string) ??
            'Unknown',
          distance: (e.metadata?.distance_km as number) ?? (e.metadata?.distance as number) ?? null,
          score: (e.metadata?.score as number) ?? (e.metadata?.matchScore as number) ?? null,
          result: e.event_type.includes('timeout')
            ? 'timed_out'
            : e.event_type.includes('reject') || e.event_type.includes('decline')
              ? 'rejected'
              : e.event_type.includes('accept') || e.event_type.includes('assign')
                ? 'accepted'
                : 'offered',
          timestamp: e.created_at,
        }))
    : [];

  return (
    <div className="min-h-screen bg-[#FFFFFF] p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Dispatch Debugger</h1>
          <p className="mt-1 text-sm text-[#86868b]">
            Inspect the dispatch pipeline for any ride. View driver offers, escalations, and assignment results.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSubmit} className="mb-8 flex gap-3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter Ride ID (UUID)"
            className="flex-1 rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-2.5 text-sm text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#0071e3]/50 focus:ring-1 focus:ring-[#0071e3]/30"
          />
          <button
            type="submit"
            disabled={loading || !searchInput.trim()}
            className="rounded-lg bg-[#0071e3] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#005bb5] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner /> Loading...
              </span>
            ) : (
              'Inspect'
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Dispatch Data */}
        {data && (
          <div className="space-y-6">
            {/* Ride Overview */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#86868b]">Ride Overview</h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <InfoCell label="Ride ID" value={data.ride.id.slice(0, 8) + '...'} mono />
                <InfoCell label="Status">
                  <StatusBadge status={data.ride.status} />
                </InfoCell>
                <InfoCell label="Requested" value={formatTime(data.ride.requested_at)} />
                <InfoCell
                  label="Completed"
                  value={data.ride.trip_completed_at ? formatTime(data.ride.trip_completed_at) : '--'}
                />
                <InfoCell label="Pickup" value={data.ride.pickup_address ?? '--'} />
                <InfoCell label="Dropoff" value={data.ride.dropoff_address ?? '--'} />
                <InfoCell label="Fare" value={`$${Number(data.ride.final_fare ?? data.ride.estimated_fare).toFixed(2)}`} />
                <InfoCell label="Surge" value={`${data.ride.surge_multiplier ?? 1}x`} />
              </div>
              {data.ride.cancel_reason && (
                <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  Cancelled: {data.ride.cancel_reason} (by {data.ride.cancelled_by})
                </div>
              )}
            </div>

            {/* Assigned Driver */}
            {data.assignedDriver && (
              <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#86868b]">Assigned Driver</h2>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <InfoCell label="Name" value={data.assignedDriver.full_name} />
                  <InfoCell label="Status">
                    <StatusBadge status={data.assignedDriver.status} />
                  </InfoCell>
                  <InfoCell label="Rating" value={data.assignedDriver.rating?.toFixed(1) ?? '--'} />
                  <InfoCell label="Total Trips" value={String(data.assignedDriver.total_trips ?? 0)} />
                </div>
              </div>
            )}

            {/* Dispatch Stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Drivers Tried" value={candidateDrivers.length} color="text-blue-400" />
              <StatCard label="Escalations" value={data.escalationCount} color="text-amber-400" />
              <StatCard label="Excluded" value={data.excludedDrivers.length} color="text-red-400" />
              <StatCard label="Nearby Available" value={data.nearbyDrivers.length} color="text-emerald-400" />
            </div>

            {/* Current Offer */}
            {data.currentOffer && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400">
                Active offer pending for driver: <span className="font-mono">{data.currentOffer}</span>
              </div>
            )}

            {/* Ride Status Timeline */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#86868b]">Status Timeline</h2>
              {data.allEvents.length === 0 ? (
                <p className="text-sm text-[#86868b]">No events recorded</p>
              ) : (
                <div className="relative space-y-0">
                  {data.allEvents.map((event, idx) => (
                    <div key={event.id} className="flex gap-4">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
                        {idx < data.allEvents.length - 1 && (
                          <div className="w-px flex-1 bg-[#d2d2d7]" />
                        )}
                      </div>
                      <div className="pb-5">
                        <p className="text-sm font-medium text-[#1d1d1f]">
                          {event.event_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-[#86868b]">
                          {formatTime(event.created_at)}
                          {event.old_status && event.new_status && (
                            <span className="ml-2">
                              {event.old_status} → {event.new_status}
                            </span>
                          )}
                          {event.actor && (
                            <span className="ml-2 text-[#86868b]">by {event.actor}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Candidate Drivers */}
            {candidateDrivers.length > 0 && (
              <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#86868b]">
                  Candidate Drivers ({candidateDrivers.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#d2d2d7] text-xs uppercase tracking-wider text-[#86868b]">
                        <th className="pb-3 pr-4">Driver</th>
                        <th className="pb-3 pr-4">Distance</th>
                        <th className="pb-3 pr-4">Score</th>
                        <th className="pb-3 pr-4">Result</th>
                        <th className="pb-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d2d2d7]">
                      {candidateDrivers.map((c, i) => (
                        <tr key={i} className="text-[#6e6e73]">
                          <td className="py-3 pr-4">
                            <span className="text-[#1d1d1f]">{c.driverName}</span>
                            {c.driverId && (
                              <span className="ml-2 font-mono text-xs text-[#86868b]">
                                {c.driverId.slice(0, 8)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {c.distance != null ? `${c.distance.toFixed(1)} km` : '--'}
                          </td>
                          <td className="py-3 pr-4">
                            {c.score != null ? c.score.toFixed(0) : '--'}
                          </td>
                          <td className="py-3 pr-4">
                            <CandidateResult result={c.result} />
                          </td>
                          <td className="py-3 text-xs text-[#86868b]">{formatTime(c.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Excluded Drivers */}
            {data.excludedDrivers.length > 0 && (
              <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#86868b]">
                  Excluded Drivers ({data.excludedDrivers.length})
                </h2>
                <div className="space-y-2">
                  {data.excludedDrivers.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 rounded-lg bg-[#FFFFFF] px-4 py-2.5 text-sm"
                    >
                      <span className="text-[#1d1d1f]">{d.full_name}</span>
                      <span className="font-mono text-xs text-[#86868b]">{d.id.slice(0, 8)}</span>
                      <span className="text-xs text-[#86868b]">{d.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nearby Available Drivers */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#86868b]">
                Nearby Available Drivers ({data.nearbyDrivers.length})
              </h2>
              {data.nearbyDrivers.length === 0 ? (
                <p className="text-sm text-[#86868b]">No available drivers within 10km</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#d2d2d7] text-xs uppercase tracking-wider text-[#86868b]">
                        <th className="pb-3 pr-4">Driver</th>
                        <th className="pb-3 pr-4">Distance</th>
                        <th className="pb-3 pr-4">Rating</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d2d2d7]">
                      {data.nearbyDrivers.map((d) => (
                        <tr key={d.id} className="text-[#6e6e73]">
                          <td className="py-3 pr-4">
                            <span className="text-[#1d1d1f]">{d.full_name}</span>
                            <span className="ml-2 font-mono text-xs text-[#86868b]">
                              {d.id.slice(0, 8)}
                            </span>
                          </td>
                          <td className="py-3 pr-4 font-mono">
                            {d.distance_km.toFixed(1)} km
                          </td>
                          <td className="py-3 pr-4">{d.rating?.toFixed(1) ?? '--'}</td>
                          <td className="py-3">
                            <StatusBadge status={d.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dispatch Events Detail */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#86868b]">
                Dispatch Events ({data.dispatchEvents.length})
              </h2>
              {data.dispatchEvents.length === 0 ? (
                <p className="text-sm text-[#86868b]">No dispatch events found</p>
              ) : (
                <div className="space-y-3">
                  {data.dispatchEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg bg-[#FFFFFF] border border-[#d2d2d7] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#1d1d1f]">
                          {event.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-[#86868b]">{formatTime(event.created_at)}</span>
                      </div>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <pre className="mt-2 overflow-x-auto rounded-md bg-[#f5f5f7] p-3 text-xs text-[#86868b]">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Active Rides (quick access) */}
        <div className="mt-8 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#86868b]">
            Active Dispatch Rides
          </h2>
          {recentLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
              <span className="ml-2 text-sm text-[#86868b]">Loading...</span>
            </div>
          ) : recentRides.length === 0 ? (
            <p className="text-sm text-[#86868b]">
              No rides currently in searching_driver or driver_assigned status
            </p>
          ) : (
            <div className="space-y-2">
              {recentRides.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSearchInput(r.id);
                    fetchDispatch(r.id);
                  }}
                  className="flex w-full items-center gap-4 rounded-lg bg-[#FFFFFF] px-4 py-3 text-left text-sm transition-colors hover:bg-[#f5f5f7]"
                >
                  <StatusBadge status={r.status} />
                  <span className="font-mono text-xs text-[#86868b]">{r.id.slice(0, 12)}...</span>
                  <span className="flex-1 truncate text-[#6e6e73]">{r.pickup_address}</span>
                  <span className="text-xs text-[#86868b]">{timeAgo(r.requested_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-[#86868b]" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-[#d2d2d7] text-[#86868b]';
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function InfoCell({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[#86868b]">{label}</p>
      {children ?? (
        <p className={`mt-1 text-sm text-[#1d1d1f] ${mono ? 'font-mono' : ''}`}>
          {value ?? '--'}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
      <p className="text-xs uppercase tracking-wider text-[#86868b]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function CandidateResult({ result }: { result: string }) {
  const map: Record<string, string> = {
    accepted: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-red-500/20 text-red-400',
    timed_out: 'bg-amber-500/20 text-amber-400',
    offered: 'bg-blue-500/20 text-blue-400',
  };
  const cls = map[result] ?? 'bg-[#d2d2d7] text-[#86868b]';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {result.replace(/_/g, ' ')}
    </span>
  );
}
