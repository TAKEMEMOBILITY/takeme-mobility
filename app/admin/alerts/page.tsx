'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME ADMIN — Alerts Dashboard
// DLQ items, fraud alerts, failed payments. Auto-refreshes every 15s.
// ═══════════════════════════════════════════════════════════════════════════

interface DLQItem {
  rideId: string;
  attempts: number;
  lastError: string;
  failedAt: number;
}

interface FraudEvent {
  id: string;
  user_id: string | null;
  ride_id: string | null;
  driver_id: string | null;
  event_type: string;
  severity: string;
  fraud_score: number;
  action_taken: string | null;
  details: Record<string, unknown>;
  device_fingerprint: string | null;
  ip_address: string | null;
  created_at: string;
}

interface FailedPayment {
  id: string;
  ride_id: string;
  rider_id: string;
  stripe_payment_intent: string;
  amount: number;
  currency: string;
  status: string;
  payment_method_type: string | null;
  created_at: string;
}

interface AlertsData {
  dlq: { items: DLQItem[]; total: number };
  fraud: { events: FraudEvent[]; total: number };
  failed_payments: { items: FailedPayment[]; total: number };
  total_alerts: number;
}

const TABS = [
  { key: 'dlq', label: 'Dead Letter Queue' },
  { key: 'fraud', label: 'Fraud Alerts' },
  { key: 'payments', label: 'Failed Payments' },
] as const;

const SEVERITY_CLASSES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400',
  high: 'bg-amber-500/15 text-amber-400',
  medium: 'bg-yellow-500/15 text-yellow-400',
  low: 'bg-blue-500/15 text-blue-400',
};

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function timeAgo(ts: number | string | null) {
  if (!ts) return '--';
  const epoch = typeof ts === 'number' ? ts : new Date(ts).getTime();
  const ms = Date.now() - epoch;
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

function fmtTime(ts: number | string | null) {
  if (!ts) return '--';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AdminAlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<string>('dlq');
  const [retryLoading, setRetryLoading] = useState('');

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/alerts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError('');
    } catch {
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const retryDLQItem = async (rideId: string) => {
    setRetryLoading(rideId);
    try {
      // Re-enqueue ride via dispatch endpoint
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId }),
      });
      if (res.ok) {
        fetchAlerts();
      } else {
        alert('Failed to retry dispatch');
      }
    } catch {
      alert('Retry failed');
    } finally {
      setRetryLoading('');
    }
  };

  const tabCounts = data
    ? {
        dlq: data.dlq.total,
        fraud: data.fraud.total,
        payments: data.failed_payments.total,
      }
    : { dlq: 0, fraud: 0, payments: 0 };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-[#71717a]">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#71717a] border-t-emerald-500" />
          Loading alerts...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e4e4e7]">Alerts</h1>
          <p className="text-sm text-[#71717a] mt-1">
            {data?.total_alerts ?? 0} total alerts{' '}
            <span className="text-[#52525b]">- auto-refreshes every 15s</span>
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchAlerts();
          }}
          className="px-4 py-2 rounded-xl text-xs font-medium bg-[#13131b] border border-[#1e1e2e] text-[#a1a1aa] hover:bg-[#1e1e2e] transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#13131b] rounded-xl p-1 w-fit border border-[#1e1e2e]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'bg-[#1e1e2e] text-white'
                : 'text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            {t.label}
            {tabCounts[t.key as keyof typeof tabCounts] > 0 && (
              <span
                className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                  t.key === 'fraud'
                    ? 'bg-amber-500/20 text-amber-400'
                    : t.key === 'payments'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {tabCounts[t.key as keyof typeof tabCounts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* DLQ Tab */}
      {tab === 'dlq' && (
        <div className="bg-[#13131b] rounded-xl border border-[#1e1e2e] overflow-hidden">
          {!data || data.dlq.items.length === 0 ? (
            <div className="py-16 text-center">
              <svg className="mx-auto mb-3 h-10 w-10 text-emerald-500/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-[#52525b]">Dead letter queue is empty</p>
              <p className="text-xs text-[#3f3f5e] mt-1">All dispatches are running smoothly</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['Ride ID', 'Attempts', 'Last Error', 'Failed At', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52525b]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.dlq.items.map((item, i) => (
                  <tr key={`${item.rideId}-${i}`} className="border-b border-[#1e1e2e]/50">
                    <td className="px-4 py-3 font-mono text-[11px] text-[#a1a1aa]">
                      {item.rideId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-500/15 text-red-400">
                        {item.attempts}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#71717a] max-w-[250px] truncate">
                      {item.lastError}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#52525b]">
                      {timeAgo(item.failedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => retryDLQItem(item.rideId)}
                        disabled={retryLoading === item.rideId}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                      >
                        {retryLoading === item.rideId ? '...' : 'Retry'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Fraud Tab */}
      {tab === 'fraud' && (
        <div className="bg-[#13131b] rounded-xl border border-[#1e1e2e] overflow-hidden">
          {!data || data.fraud.events.length === 0 ? (
            <div className="py-16 text-center">
              <svg className="mx-auto mb-3 h-10 w-10 text-emerald-500/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <p className="text-sm text-[#52525b]">No high-severity fraud events</p>
              <p className="text-xs text-[#3f3f5e] mt-1">All fraud checks are passing</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['Type', 'Severity', 'Score', 'User / Ride', 'Action Taken', 'Time'].map(
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
                {data.fraud.events.map((event) => (
                  <tr key={event.id} className="border-b border-[#1e1e2e]/50">
                    <td className="px-4 py-3 text-xs text-[#a1a1aa]">
                      {event.event_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          SEVERITY_CLASSES[event.severity] ?? 'bg-zinc-500/15 text-zinc-400'
                        }`}
                      >
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-bold ${
                          event.fraud_score >= 80
                            ? 'text-red-400'
                            : event.fraud_score >= 50
                            ? 'text-amber-400'
                            : 'text-[#a1a1aa]'
                        }`}
                      >
                        {event.fraud_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {event.user_id && (
                          <p className="font-mono text-[10px] text-[#71717a]">
                            User: {event.user_id.slice(0, 8)}
                          </p>
                        )}
                        {event.ride_id && (
                          <p className="font-mono text-[10px] text-[#52525b]">
                            Ride: {event.ride_id.slice(0, 8)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#71717a]">
                      {event.action_taken ?? 'None'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#52525b]">
                      {timeAgo(event.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Failed Payments Tab */}
      {tab === 'payments' && (
        <div className="bg-[#13131b] rounded-xl border border-[#1e1e2e] overflow-hidden">
          {!data || data.failed_payments.items.length === 0 ? (
            <div className="py-16 text-center">
              <svg className="mx-auto mb-3 h-10 w-10 text-emerald-500/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
              <p className="text-sm text-[#52525b]">No failed payments</p>
              <p className="text-xs text-[#3f3f5e] mt-1">All payment processing is healthy</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['Payment ID', 'Ride', 'Amount', 'Method', 'Stripe PI', 'Time'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52525b]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.failed_payments.items.map((payment) => (
                  <tr key={payment.id} className="border-b border-[#1e1e2e]/50">
                    <td className="px-4 py-3 font-mono text-[11px] text-[#71717a]">
                      {payment.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#52525b]">
                      {payment.ride_id?.slice(0, 8) ?? '--'}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-red-400">
                      {payment.currency?.toUpperCase()} {usd(Number(payment.amount))}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#71717a]">
                      {payment.payment_method_type ?? '--'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[#52525b] max-w-[120px] truncate">
                      {payment.stripe_payment_intent ?? '--'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#52525b]">
                      {timeAgo(payment.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          <SummaryCard
            title="DLQ Items"
            count={data.dlq.total}
            description="Failed dispatch attempts awaiting retry"
            color={data.dlq.total > 0 ? 'text-blue-400' : 'text-emerald-400'}
            bgColor={data.dlq.total > 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}
          />
          <SummaryCard
            title="Fraud Events"
            count={data.fraud.total}
            description="High or critical severity fraud events"
            color={data.fraud.total > 0 ? 'text-amber-400' : 'text-emerald-400'}
            bgColor={data.fraud.total > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}
          />
          <SummaryCard
            title="Failed Payments"
            count={data.failed_payments.total}
            description="Payments that could not be processed"
            color={data.failed_payments.total > 0 ? 'text-red-400' : 'text-emerald-400'}
            bgColor={data.failed_payments.total > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}
          />
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  count,
  description,
  color,
  bgColor,
}: {
  title: string;
  count: number;
  description: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${bgColor}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#52525b] mb-2">
        {title}
      </p>
      <p className={`text-3xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-[#52525b] mt-1">{description}</p>
    </div>
  );
}
