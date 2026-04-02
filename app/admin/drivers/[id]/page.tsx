'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface DriverData {
  driver: {
    id: string;
    auth_user_id: string;
    full_name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
    license_number: string | null;
    status: string;
    rating: number;
    total_trips: number;
    is_verified: boolean;
    is_active: boolean;
    accepts_pets: boolean;
    created_at: string;
    last_location_at: string | null;
  };
  wallet: {
    available: number;
    pending: number;
    lifetime: number;
    card_balance: number;
  };
  vehicles: Array<{
    id: string;
    make: string;
    model: string;
    year: number;
    color: string;
    plate: string;
    vehicle_class: string;
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
    rider_rating: number | null;
    driver_rating: number | null;
    rider_name: string | null;
  }>;
  fraudEvents: Array<{
    id: string;
    event_type: string;
    severity: string;
    fraud_score: number;
    action_taken: string;
    details: Record<string, unknown>;
    created_at: string;
    ride_id: string | null;
  }>;
  stats: {
    total_assigned: number;
    completed: number;
    cancelled: number;
    acceptance_rate: number;
    cancel_rate: number;
  };
}

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const ago = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: 'text-emerald-400 bg-emerald-400/10' },
  busy: { label: 'On Trip', color: 'text-blue-400 bg-blue-400/10' },
  offline: { label: 'Offline', color: 'text-[#71717a] bg-[#71717a]/10' },
  en_route: { label: 'En Route', color: 'text-violet-400 bg-violet-400/10' },
};

const RIDE_STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-500 bg-emerald-500/10',
  cancelled: 'text-red-400 bg-red-400/10',
  in_progress: 'text-emerald-400 bg-emerald-400/10',
  searching_driver: 'text-amber-400 bg-amber-400/10',
  driver_assigned: 'text-blue-400 bg-blue-400/10',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-blue-400 bg-blue-400/10',
  medium: 'text-amber-400 bg-amber-400/10',
  high: 'text-orange-400 bg-orange-400/10',
  critical: 'text-red-400 bg-red-400/10',
};

export default function DriverProfilePage() {
  const params = useParams<{ id: string }>();
  const driverId = params.id;

  const [data, setData] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const fetchDriver = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/drivers/${driverId}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load driver');
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchDriver();
  }, [fetchDriver]);

  const performAction = async (action: string, extras?: Record<string, string>) => {
    setActionLoading(true);
    setActionMessage('');
    try {
      const res = await fetch(`/api/admin/drivers/${driverId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extras }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionMessage(`Error: ${json.error}`);
      } else {
        setActionMessage(json.message || 'Action completed');
        fetchDriver();
      }
    } catch {
      setActionMessage('Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    performAction('add_note', { note: noteText.trim() });
    setNoteText('');
    setShowNoteModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <Link href="/admin" className="text-xs text-emerald-400 hover:text-emerald-300">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { driver, wallet, vehicles, recent_rides, fraudEvents, stats } = data;
  const statusInfo = STATUS_MAP[driver.status] ?? { label: driver.status, color: 'text-[#71717a] bg-[#71717a]/10' };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 lg:p-8">
      <div className="mx-auto max-w-[1200px]">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs text-[#71717a]">
          <Link href="/admin" className="hover:text-[#a1a1aa] transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/admin/drivers" className="hover:text-[#a1a1aa] transition-colors">Drivers</Link>
          <span>/</span>
          <span className="text-[#e4e4e7]">{driver.full_name || driver.email}</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 text-xl font-bold">
              {(driver.full_name || driver.email)?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-[#e4e4e7]">{driver.full_name || 'Unknown'}</h1>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {driver.is_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
              <p className="text-sm text-[#71717a]">{driver.email}</p>
              {driver.phone && <p className="text-sm text-[#71717a]">{driver.phone}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {driver.is_active ? (
              <button
                onClick={() => performAction('suspend')}
                disabled={actionLoading}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                Suspend Driver
              </button>
            ) : (
              <button
                onClick={() => performAction('activate')}
                disabled={actionLoading}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Activate Driver
              </button>
            )}
            <button
              onClick={() => setShowNoteModal(true)}
              disabled={actionLoading}
              className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
            >
              Add Note
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className={`mb-6 rounded-lg border px-4 py-3 text-xs font-medium ${
            actionMessage.startsWith('Error') ? 'border-red-500/30 bg-red-500/5 text-red-400' : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
          }`}>
            {actionMessage}
          </div>
        )}

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="Rating" value={driver.rating ? `${Number(driver.rating).toFixed(1)}` : 'N/A'} accent="text-amber-400" />
          <StatCard label="Total Trips" value={String(driver.total_trips ?? stats.completed)} accent="text-emerald-400" />
          <StatCard label="Acceptance Rate" value={`${stats.acceptance_rate}%`} accent={stats.acceptance_rate >= 80 ? 'text-emerald-400' : 'text-amber-400'} />
          <StatCard label="Earnings" value={usd(Number(wallet.lifetime ?? 0))} accent="text-blue-400" sub={`Available: ${usd(Number(wallet.available ?? 0))}`} />
          <StatCard label="Trips Today" value={String(0)} accent="text-violet-400" sub={`Week: ${0}`} />
        </div>

        {/* Vehicle Info + Wallet */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Vehicles */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <h3 className="mb-4 text-sm font-semibold text-[#e4e4e7]">Vehicles</h3>
            {vehicles.length === 0 ? (
              <p className="text-sm text-[#71717a]">No vehicles registered</p>
            ) : (
              <div className="space-y-3">
                {vehicles.map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-4">
                    <div>
                      <p className="text-sm font-medium text-[#e4e4e7]">
                        {v.year} {v.make} {v.model}
                        {v.color && <span className="ml-2 text-[#71717a]">({v.color})</span>}
                      </p>
                      <p className="mt-1 text-xs text-[#71717a]">
                        Plate: <span className="font-mono text-[#a1a1aa]">{v.plate}</span>
                        {' '} -- Class: <span className="capitalize text-[#a1a1aa]">{v.vehicle_class}</span>
                      </p>
                    </div>
                    {v.is_active && (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                        Active
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Wallet */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <h3 className="mb-4 text-sm font-semibold text-[#e4e4e7]">Wallet</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">Available</p>
                <p className="mt-1 text-lg font-bold text-emerald-400">{usd(Number(wallet.available ?? 0))}</p>
              </div>
              <div className="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">Pending</p>
                <p className="mt-1 text-lg font-bold text-amber-400">{usd(Number(wallet.pending ?? 0))}</p>
              </div>
              <div className="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">Lifetime</p>
                <p className="mt-1 text-lg font-bold text-blue-400">{usd(Number(wallet.lifetime ?? 0))}</p>
              </div>
              <div className="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">Card Balance</p>
                <p className="mt-1 text-lg font-bold text-violet-400">{usd(Number(wallet.card_balance ?? 0))}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Rides */}
        <div className="mb-8 rounded-xl border border-[#1e1e2e] bg-[#0f0f17] overflow-hidden">
          <div className="border-b border-[#1e1e2e] px-5 py-4">
            <h3 className="text-sm font-semibold text-[#e4e4e7]">Recent Rides ({recent_rides.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['Status', 'Rider', 'Pickup', 'Dropoff', 'Class', 'Fare', 'Rating', 'When'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent_rides.map(r => (
                  <tr key={r.id} className="border-b border-[#1e1e2e]/50 transition-colors hover:bg-[#1e1e2e]/30">
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${RIDE_STATUS_COLORS[r.status] ?? 'text-[#71717a] bg-[#71717a]/10'}`}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa]">{r.rider_name ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa] max-w-[120px] truncate">{r.pickup_address}</td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa] max-w-[120px] truncate">{r.dropoff_address}</td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa] capitalize">{r.vehicle_class}</td>
                    <td className="px-4 py-3 text-xs font-medium text-[#e4e4e7]">{usd(Number(r.final_fare ?? r.estimated_fare))}</td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa]">
                      {r.rider_rating != null ? `${r.rider_rating}/5` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#71717a]">{ago(r.requested_at)}</td>
                  </tr>
                ))}
                {recent_rides.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#71717a]">No rides found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fraud Events */}
        {fraudEvents.length > 0 && (
          <div className="mb-8 rounded-xl border border-[#1e1e2e] bg-[#0f0f17] overflow-hidden">
            <div className="border-b border-[#1e1e2e] px-5 py-4">
              <h3 className="text-sm font-semibold text-[#e4e4e7]">Fraud Events ({fraudEvents.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    {['Type', 'Severity', 'Score', 'Action', 'When', 'Details'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fraudEvents.map(ev => (
                    <tr key={ev.id} className="border-b border-[#1e1e2e]/50 transition-colors hover:bg-[#1e1e2e]/30">
                      <td className="px-4 py-3 text-xs text-[#e4e4e7] font-medium">{ev.event_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SEVERITY_COLORS[ev.severity] ?? 'text-[#71717a] bg-[#71717a]/10'}`}>
                          {ev.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa]">{ev.fraud_score}</td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa]">{ev.action_taken.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-xs text-[#71717a]">{fmtDate(ev.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-[#71717a] max-w-[200px]">
                        <pre className="whitespace-pre-wrap break-all text-[10px] text-[#52525b]">
                          {JSON.stringify(ev.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Note Modal */}
        {showNoteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-6 shadow-2xl">
              <h3 className="mb-4 text-sm font-semibold text-[#e4e4e7]">Add Note for {driver.full_name || driver.email}</h3>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Enter note..."
                rows={4}
                className="mb-4 w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-4 py-3 text-sm text-[#e4e4e7] placeholder-[#52525b] outline-none focus:border-emerald-500/50"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowNoteModal(false); setNoteText(''); }}
                  className="rounded-lg border border-[#1e1e2e] px-4 py-2 text-xs font-medium text-[#71717a] hover:text-[#a1a1aa] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">{label}</p>
      <p className={`mt-2 text-lg font-bold ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-[#52525b]">{sub}</p>}
    </div>
  );
}
