'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────

interface FraudEvent {
  id: string;
  user_id: string;
  ride_id: string | null;
  driver_id: string | null;
  event_type: string;
  severity: 'low' | 'high' | 'critical';
  fraud_score: number;
  action_taken: string;
  details: { checks?: FraudCheck[]; reasons?: string[] } | null;
  device_fingerprint: string | null;
  ip_address: string | null;
  created_at: string;
}

interface FlaggedTrip {
  id: string;
  ride_id: string;
  score: number;
  checks: FraudCheck[];
  flagged: boolean;
  auto_cancelled: boolean;
  created_at: string;
}

interface FraudCheck {
  check?: string;
  name?: string;
  score: number;
  weight: number;
  detail?: string;
  details?: string;
  passed?: boolean;
}

interface DeviceBan {
  id: string;
  device_fingerprint: string;
  ip_address: string | null;
  user_id: string | null;
  reason: string;
  banned_by: string;
  created_at: string;
}

interface FraudData {
  events: FraudEvent[];
  flaggedTrips: FlaggedTrip[];
  bannedDeviceCount: number;
  stats: {
    criticalEvents: number;
    highEvents: number;
    autoCancelled: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
};

const scoreColor = (score: number) => {
  if (score >= 90) return 'text-red-400';
  if (score >= 70) return 'text-amber-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-emerald-400';
};

const scoreBg = (score: number) => {
  if (score >= 90) return 'bg-red-500/20 text-red-400';
  if (score >= 70) return 'bg-amber-500/20 text-amber-400';
  return 'bg-emerald-500/20 text-emerald-400';
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  critical: 'bg-red-500/20 text-red-400',
};

const ACTION_COLORS: Record<string, string> = {
  allow: 'bg-emerald-500/20 text-emerald-400',
  flag: 'bg-amber-500/20 text-amber-400',
  cancel: 'bg-red-500/20 text-red-400',
  ban: 'bg-red-500/20 text-red-300',
  dismissed: 'bg-[#d2d2d7] text-[#86868b]',
};

type Tab = 'flagged' | 'events' | 'bans';

// ── Component ────────────────────────────────────────────────────────────

export default function FraudPage() {
  const [data, setData] = useState<FraudData | null>(null);
  const [bans, setBans] = useState<DeviceBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('flagged');
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [banForm, setBanForm] = useState({ fingerprint: '', reason: '', userId: '', ip: '' });
  const [showBanForm, setShowBanForm] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [fraudRes, bansRes] = await Promise.all([
        fetch('/api/admin/fraud'),
        fetch('/api/admin/fraud?bans=1').catch(() => null),
      ]);

      if (!fraudRes.ok) {
        if (fraudRes.status === 401 || fraudRes.status === 403) {
          setError('Admin access required');
          return;
        }
        setError('Failed to load fraud data');
        return;
      }

      const fraudData = await fraudRes.json();
      setData(fraudData);

      // Fetch device bans separately if API supports it, otherwise use count
      // The existing fraud API doesn't list bans, so we'll work with what we have
      setError('');
    } catch {
      setError('Failed to load fraud data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const performAction = async (
    action: string,
    payload: Record<string, unknown>,
  ) => {
    const key = `${action}-${payload.eventId ?? payload.fingerprint ?? ''}`;
    setActionLoading(key);
    try {
      const res = await fetch('/api/admin/fraud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Action failed');
      } else {
        fetchData();
        if (action === 'ban_device') {
          setShowBanForm(false);
          setBanForm({ fingerprint: '', reason: '', userId: '', ip: '' });
        }
      }
    } catch {
      alert('Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const forceCancelRide = async (rideId: string) => {
    setActionLoading(`cancel-${rideId}`);
    try {
      const res = await fetch('/api/admin/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force_cancel',
          rideId,
          reason: 'Cancelled due to fraud detection',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Failed to cancel ride');
      } else {
        fetchData();
      }
    } catch {
      alert('Failed to cancel ride');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF]">
        <Spinner />
        <span className="ml-2 text-sm text-[#86868b]">Loading fraud data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF]">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalFlagged = data.flaggedTrips.length;
  const autoCancelled = data.stats.autoCancelled;
  const criticalEvents = data.stats.criticalEvents;
  const bannedDevices = data.bannedDeviceCount;

  return (
    <div className="min-h-screen bg-[#FFFFFF] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Fraud Detection</h1>
          <p className="mt-1 text-sm text-[#86868b]">
            Monitor flagged rides, fraud events, and device bans. Auto-refreshes every 30s.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Flagged Rides" value={totalFlagged} color="text-amber-400" />
          <StatCard label="Auto-Cancelled" value={autoCancelled} color="text-red-400" />
          <StatCard label="Critical Events" value={criticalEvents} color="text-red-400" />
          <StatCard label="Banned Devices" value={bannedDevices} color="text-purple-400" />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-1">
          {([
            { key: 'flagged' as const, label: 'Flagged Rides' },
            { key: 'events' as const, label: 'Fraud Events' },
            { key: 'bans' as const, label: 'Device Bans' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#d2d2d7] text-[#1d1d1f]'
                  : 'text-[#86868b] hover:text-[#6e6e73]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'flagged' && (
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7]">
            {data.flaggedTrips.length === 0 ? (
              <div className="py-20 text-center text-sm text-[#86868b]">
                No flagged trips
              </div>
            ) : (
              <div className="divide-y divide-[#d2d2d7]">
                {data.flaggedTrips.map((trip) => {
                  const isExpanded = expandedTrip === trip.id;
                  const checks = trip.checks ?? [];
                  return (
                    <div key={trip.id}>
                      <div
                        onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}
                        className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-[#f5f5f7]"
                      >
                        {/* Expand Icon */}
                        <svg
                          className={`h-4 w-4 shrink-0 text-[#86868b] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>

                        {/* Ride ID */}
                        <span className="font-mono text-xs text-[#6e6e73]">
                          {trip.ride_id.slice(0, 8)}...
                        </span>

                        {/* Score */}
                        <span
                          className={`rounded-full px-3 py-0.5 text-xs font-bold ${scoreBg(trip.score)}`}
                        >
                          {trip.score}
                        </span>

                        {/* Auto-cancelled badge */}
                        {trip.auto_cancelled && (
                          <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-400">
                            auto-cancelled
                          </span>
                        )}

                        {/* Failed checks count */}
                        <span className="text-xs text-[#86868b]">
                          {checks.filter((c) => c.passed === false).length} checks failed
                        </span>

                        {/* Time */}
                        <span className="ml-auto text-xs text-[#86868b]">
                          {timeAgo(trip.created_at)}
                        </span>
                      </div>

                      {/* Expanded: Check Breakdown */}
                      {isExpanded && (
                        <div className="border-t border-[#d2d2d7] bg-[#FFFFFF] px-5 py-4">
                          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#86868b]">
                            Check Breakdown
                          </h4>
                          <div className="space-y-2">
                            {checks.map((check, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 rounded-lg bg-[#f5f5f7] border border-[#d2d2d7] px-4 py-3"
                              >
                                {/* Pass/Fail indicator */}
                                <div
                                  className={`h-2 w-2 rounded-full ${
                                    check.passed === false ? 'bg-red-500' : 'bg-emerald-500'
                                  }`}
                                />
                                {/* Check name */}
                                <span className="min-w-[140px] text-xs font-medium text-[#1d1d1f]">
                                  {(check.check ?? check.name ?? 'Unknown').replace(/_/g, ' ')}
                                </span>
                                {/* Score */}
                                <span className={`min-w-[40px] text-xs font-bold ${scoreColor(check.score)}`}>
                                  {check.score}
                                </span>
                                {/* Weight */}
                                <span className="min-w-[40px] text-xs text-[#86868b]">
                                  w: {check.weight}
                                </span>
                                {/* Detail */}
                                <span className="flex-1 truncate text-xs text-[#86868b]">
                                  {check.detail ?? check.details ?? ''}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Actions */}
                          <div className="mt-4 flex gap-3">
                            {!trip.auto_cancelled && (
                              <button
                                onClick={() => forceCancelRide(trip.ride_id)}
                                disabled={actionLoading === `cancel-${trip.ride_id}`}
                                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                              >
                                {actionLoading === `cancel-${trip.ride_id}` ? 'Cancelling...' : 'Force Cancel Ride'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7]">
            {data.events.length === 0 ? (
              <div className="py-20 text-center text-sm text-[#86868b]">
                No fraud events
              </div>
            ) : (
              <div className="divide-y divide-[#d2d2d7]">
                {data.events.map((event) => {
                  const isExpanded = expandedEvent === event.id;
                  return (
                    <div key={event.id}>
                      <div
                        onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                        className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-[#f5f5f7]"
                      >
                        {/* Expand Icon */}
                        <svg
                          className={`h-4 w-4 shrink-0 text-[#86868b] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>

                        {/* Event Type */}
                        <span className="min-w-[120px] text-sm text-[#1d1d1f]">
                          {event.event_type.replace(/_/g, ' ')}
                        </span>

                        {/* Severity */}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            SEVERITY_COLORS[event.severity] ?? 'bg-[#d2d2d7] text-[#86868b]'
                          }`}
                        >
                          {event.severity}
                        </span>

                        {/* Score */}
                        <span className={`text-xs font-bold ${scoreColor(event.fraud_score)}`}>
                          {event.fraud_score}
                        </span>

                        {/* User / Ride */}
                        <span className="font-mono text-xs text-[#86868b]">
                          user: {event.user_id?.slice(0, 8) ?? '--'}
                        </span>
                        {event.ride_id && (
                          <span className="font-mono text-xs text-[#86868b]">
                            ride: {event.ride_id.slice(0, 8)}
                          </span>
                        )}

                        {/* Action Taken */}
                        <span
                          className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            ACTION_COLORS[event.action_taken] ?? 'bg-[#d2d2d7] text-[#86868b]'
                          }`}
                        >
                          {event.action_taken}
                        </span>

                        {/* Time */}
                        <span className="text-xs text-[#86868b]">
                          {timeAgo(event.created_at)}
                        </span>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-[#d2d2d7] bg-[#FFFFFF] px-5 py-4">
                          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                            <InfoCell label="Event ID" value={event.id.slice(0, 12) + '...'} />
                            <InfoCell label="User ID" value={event.user_id ?? '--'} />
                            <InfoCell label="Driver ID" value={event.driver_id ?? '--'} />
                            <InfoCell label="Device" value={event.device_fingerprint ?? '--'} />
                            <InfoCell label="IP" value={event.ip_address ?? '--'} />
                            <InfoCell label="Timestamp" value={formatDate(event.created_at)} />
                          </div>

                          {/* Check details if available */}
                          {event.details?.checks && event.details.checks.length > 0 && (
                            <div className="mt-4">
                              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#86868b]">
                                Checks
                              </h4>
                              <div className="space-y-1">
                                {event.details.checks.map((check, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-3 text-xs text-[#6e6e73]"
                                  >
                                    <div
                                      className={`h-1.5 w-1.5 rounded-full ${
                                        check.passed === false ? 'bg-red-500' : 'bg-emerald-500'
                                      }`}
                                    />
                                    <span className="min-w-[120px] font-medium">
                                      {(check.check ?? check.name ?? '').replace(/_/g, ' ')}
                                    </span>
                                    <span className={scoreColor(check.score)}>{check.score}</span>
                                    <span className="text-[#86868b]">{check.detail ?? check.details ?? ''}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {event.details?.reasons && event.details.reasons.length > 0 && (
                            <div className="mt-3">
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#86868b]">
                                Reasons
                              </h4>
                              <ul className="list-inside list-disc text-xs text-[#86868b]">
                                {event.details.reasons.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="mt-4 flex gap-3">
                            {event.action_taken !== 'dismissed' && (
                              <button
                                onClick={() =>
                                  performAction('dismiss', { eventId: event.id })
                                }
                                disabled={actionLoading === `dismiss-${event.id}`}
                                className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-2 text-xs font-semibold text-[#6e6e73] transition-colors hover:bg-[#d2d2d7] disabled:opacity-40"
                              >
                                {actionLoading === `dismiss-${event.id}` ? 'Dismissing...' : 'Dismiss'}
                              </button>
                            )}
                            {event.device_fingerprint && (
                              <button
                                onClick={() =>
                                  performAction('ban_device', {
                                    fingerprint: event.device_fingerprint,
                                    reason: `Banned from fraud event ${event.id.slice(0, 8)}`,
                                    userId: event.user_id,
                                    ip: event.ip_address,
                                  })
                                }
                                disabled={actionLoading === `ban_device-${event.device_fingerprint}`}
                                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                              >
                                {actionLoading === `ban_device-${event.device_fingerprint}`
                                  ? 'Banning...'
                                  : 'Ban Device'}
                              </button>
                            )}
                            {event.ride_id && event.action_taken !== 'cancel' && (
                              <button
                                onClick={() => forceCancelRide(event.ride_id!)}
                                disabled={actionLoading === `cancel-${event.ride_id}`}
                                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-40"
                              >
                                {actionLoading === `cancel-${event.ride_id}`
                                  ? 'Cancelling...'
                                  : 'Force Cancel Ride'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bans' && (
          <div className="space-y-6">
            {/* Ban Device Form */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#86868b]">
                  Banned Devices ({bannedDevices})
                </h3>
                <button
                  onClick={() => setShowBanForm(!showBanForm)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500"
                >
                  {showBanForm ? 'Cancel' : 'Ban Device'}
                </button>
              </div>

              {showBanForm && (
                <div className="mt-4 space-y-3 rounded-lg border border-[#d2d2d7] bg-[#FFFFFF] p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={banForm.fingerprint}
                      onChange={(e) =>
                        setBanForm({ ...banForm, fingerprint: e.target.value })
                      }
                      placeholder="Device fingerprint (required)"
                      className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-xs text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#0071e3]/50"
                    />
                    <input
                      type="text"
                      value={banForm.reason}
                      onChange={(e) =>
                        setBanForm({ ...banForm, reason: e.target.value })
                      }
                      placeholder="Reason (required)"
                      className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-xs text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#0071e3]/50"
                    />
                    <input
                      type="text"
                      value={banForm.userId}
                      onChange={(e) =>
                        setBanForm({ ...banForm, userId: e.target.value })
                      }
                      placeholder="User ID (optional)"
                      className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-xs text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#0071e3]/50"
                    />
                    <input
                      type="text"
                      value={banForm.ip}
                      onChange={(e) =>
                        setBanForm({ ...banForm, ip: e.target.value })
                      }
                      placeholder="IP address (optional)"
                      className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-xs text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#0071e3]/50"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!banForm.fingerprint.trim() || !banForm.reason.trim()) {
                        alert('Fingerprint and reason are required');
                        return;
                      }
                      performAction('ban_device', {
                        fingerprint: banForm.fingerprint,
                        reason: banForm.reason,
                        userId: banForm.userId || undefined,
                        ip: banForm.ip || undefined,
                      });
                    }}
                    disabled={!!actionLoading}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                  >
                    {actionLoading ? 'Banning...' : 'Confirm Ban'}
                  </button>
                </div>
              )}
            </div>

            {/* Bans info note */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <p className="text-sm text-[#86868b]">
                Device bans are permanent. Banned devices are checked on every ride request and account login.
                Bans can be applied from fraud events above, or manually using the form.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-[#FFFFFF] border border-[#d2d2d7] p-4 text-center">
                  <p className="text-2xl font-bold text-purple-400">{bannedDevices}</p>
                  <p className="mt-1 text-xs text-[#86868b]">Total Bans</p>
                </div>
                <div className="rounded-lg bg-[#FFFFFF] border border-[#d2d2d7] p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">{criticalEvents}</p>
                  <p className="mt-1 text-xs text-[#86868b]">Critical Events</p>
                </div>
                <div className="rounded-lg bg-[#FFFFFF] border border-[#d2d2d7] p-4 text-center">
                  <p className="text-2xl font-bold text-amber-400">{autoCancelled}</p>
                  <p className="mt-1 text-xs text-[#86868b]">Auto-Cancelled</p>
                </div>
              </div>
            </div>
          </div>
        )}
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
      <p className="text-xs uppercase tracking-wider text-[#86868b]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[#86868b]">{label}</p>
      <p className="mt-1 truncate font-mono text-xs text-[#6e6e73]">{value}</p>
    </div>
  );
}
