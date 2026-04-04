'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  ride_id: string;
  rider_id: string;
  stripe_payment_intent: string;
  stripe_charge_id: string | null;
  payment_method_type: string;
  amount: number;
  currency: string;
  status: string;
  authorized_at: string | null;
  captured_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  failure_reason: string | null;
  rides: { pickup_address: string; dropoff_address: string };
  riders: { full_name: string; email: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────

const usd = (cents: number, currency = 'usd') => {
  const val = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(val);
};

const formatDate = (iso: string | null) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  authorized: 'bg-blue-500/20 text-blue-400',
  captured: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
  refunded: 'bg-purple-500/20 text-purple-400',
  disputed: 'bg-red-500/20 text-red-300',
  resolved: 'bg-[#d2d2d7] text-[#86868b]',
};

const TABS = ['all', 'captured', 'failed', 'refunded', 'disputed', 'pending'] as const;
type TabStatus = (typeof TABS)[number];

// ── Component ────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabStatus>('all');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [actionReason, setActionReason] = useState('');

  const limit = 50;

  const fetchPayments = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (activeTab !== 'all') params.set('status', activeTab);

      const res = await fetch(`/api/admin/payments?${params}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      setPayments(data.payments ?? []);
      setTotal(data.total ?? 0);
      setError('');
    } catch {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [activeTab, offset]);

  useEffect(() => {
    setLoading(true);
    fetchPayments();
    const interval = setInterval(fetchPayments, 30000);
    return () => clearInterval(interval);
  }, [fetchPayments]);

  // Reset offset when tab changes
  useEffect(() => {
    setOffset(0);
  }, [activeTab]);

  const selectedPayment = payments.find((p) => p.id === selectedId) ?? null;

  const performAction = async (action: string, paymentId: string) => {
    setActionLoading(action);
    setActionError('');
    try {
      const body: Record<string, unknown> = { action, paymentId };
      if (action === 'refund') {
        body.reason = actionReason || 'Admin refund';
        if (refundAmount.trim()) {
          const amountCents = Math.round(parseFloat(refundAmount) * 100);
          if (isNaN(amountCents) || amountCents <= 0) {
            setActionError('Invalid refund amount');
            setActionLoading('');
            return;
          }
          body.amount = amountCents;
        }
      }
      if (action === 'mark_resolved') {
        body.reason = actionReason || 'Resolved by admin';
      }

      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error ?? 'Action failed');
      } else {
        setSelectedId(null);
        setRefundAmount('');
        setActionReason('');
        fetchPayments();
      }
    } catch {
      setActionError('Action failed');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1d1d1f]">Payments</h1>
            <p className="mt-1 text-sm text-[#86868b]">
              Manage payment captures, refunds, and disputes. Auto-refreshes every 30s.
            </p>
          </div>
          <div className="text-xs text-[#86868b]">
            {total} total
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-2 text-xs font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-[#d2d2d7] text-[#1d1d1f]'
                  : 'text-[#86868b] hover:text-[#6e6e73]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-6">
          {/* Table */}
          <div className="flex-1 overflow-hidden rounded-xl border border-[#d2d2d7] bg-[#f5f5f7]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner />
                <span className="ml-2 text-sm text-[#86868b]">Loading payments...</span>
              </div>
            ) : payments.length === 0 ? (
              <div className="py-20 text-center text-sm text-[#86868b]">
                No payments found
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#d2d2d7] text-xs uppercase tracking-wider text-[#86868b]">
                        <th className="px-4 py-3">Ride</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Rider</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d2d2d7]">
                      {payments.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                          className={`cursor-pointer transition-colors ${
                            p.status === 'failed' || p.status === 'disputed'
                              ? 'bg-red-500/5'
                              : ''
                          } ${
                            selectedId === p.id
                              ? 'bg-[#d2d2d7]'
                              : 'hover:bg-[#f5f5f7]'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-[#6e6e73]">
                            {p.ride_id.slice(0, 8)}...
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#1d1d1f]">
                            {usd(p.amount, p.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-4 py-3 text-[#6e6e73]">
                            {p.payment_method_type ?? '--'}
                          </td>
                          <td className="px-4 py-3 text-[#6e6e73]">
                            {p.riders?.full_name ?? '--'}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#86868b]">
                            {formatDate(p.authorized_at ?? p.captured_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {total > limit && (
                  <div className="flex items-center justify-between border-t border-[#d2d2d7] px-4 py-3">
                    <span className="text-xs text-[#86868b]">
                      Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                        disabled={offset === 0}
                        className="rounded-md border border-[#d2d2d7] px-3 py-1.5 text-xs text-[#6e6e73] transition-colors hover:bg-[#d2d2d7] disabled:opacity-30"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setOffset(offset + limit)}
                        disabled={offset + limit >= total}
                        className="rounded-md border border-[#d2d2d7] px-3 py-1.5 text-xs text-[#6e6e73] transition-colors hover:bg-[#d2d2d7] disabled:opacity-30"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Detail Panel */}
          {selectedPayment && (
            <div className="w-96 shrink-0 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#86868b]">
                  Payment Details
                </h3>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-[#86868b] hover:text-[#6e6e73]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Amount & Status */}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#1d1d1f]">
                    {usd(selectedPayment.amount, selectedPayment.currency)}
                  </span>
                  <StatusBadge status={selectedPayment.status} />
                </div>

                {/* Payment Info */}
                <div className="space-y-2 rounded-lg bg-[#FFFFFF] p-3">
                  <DetailRow label="Payment ID" value={selectedPayment.id.slice(0, 12) + '...'} mono />
                  <DetailRow label="Stripe PI" value={selectedPayment.stripe_payment_intent ?? '--'} mono />
                  <DetailRow label="Charge ID" value={selectedPayment.stripe_charge_id ?? '--'} mono />
                  <DetailRow label="Method" value={selectedPayment.payment_method_type ?? '--'} />
                  <DetailRow label="Currency" value={selectedPayment.currency.toUpperCase()} />
                </div>

                {/* Ride Info */}
                <div className="space-y-2 rounded-lg bg-[#FFFFFF] p-3">
                  <p className="text-xs uppercase tracking-wider text-[#86868b]">Ride Info</p>
                  <DetailRow label="Ride ID" value={selectedPayment.ride_id.slice(0, 12) + '...'} mono />
                  <DetailRow label="Pickup" value={selectedPayment.rides?.pickup_address ?? '--'} />
                  <DetailRow label="Dropoff" value={selectedPayment.rides?.dropoff_address ?? '--'} />
                  <DetailRow label="Rider" value={selectedPayment.riders?.full_name ?? '--'} />
                </div>

                {/* Status Timeline */}
                <div className="space-y-2 rounded-lg bg-[#FFFFFF] p-3">
                  <p className="text-xs uppercase tracking-wider text-[#86868b]">Status Timeline</p>
                  <TimelineEntry
                    label="Authorized"
                    time={selectedPayment.authorized_at}
                    active={!!selectedPayment.authorized_at}
                  />
                  <TimelineEntry
                    label="Captured"
                    time={selectedPayment.captured_at}
                    active={!!selectedPayment.captured_at}
                  />
                  {selectedPayment.failed_at && (
                    <TimelineEntry
                      label="Failed"
                      time={selectedPayment.failed_at}
                      active
                      error
                    />
                  )}
                  {selectedPayment.refunded_at && (
                    <TimelineEntry
                      label="Refunded"
                      time={selectedPayment.refunded_at}
                      active
                    />
                  )}
                  {selectedPayment.failure_reason && (
                    <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-400">
                      {selectedPayment.failure_reason}
                    </div>
                  )}
                </div>

                {/* Action Error */}
                {actionError && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                    {actionError}
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3 border-t border-[#d2d2d7] pt-4">
                  <p className="text-xs uppercase tracking-wider text-[#86868b]">Actions</p>

                  {/* Reason Input */}
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Reason (required for refund/resolve)"
                    className="w-full rounded-lg border border-[#d2d2d7] bg-[#FFFFFF] px-3 py-2 text-xs text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#1D6AE5]/50"
                  />

                  {/* Retry Capture */}
                  {selectedPayment.status === 'authorized' && (
                    <button
                      onClick={() => performAction('retry_capture', selectedPayment.id)}
                      disabled={!!actionLoading}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
                    >
                      {actionLoading === 'retry_capture' ? 'Capturing...' : 'Retry Capture'}
                    </button>
                  )}

                  {/* Refund */}
                  {selectedPayment.status === 'captured' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder={`Partial amount in dollars (leave blank for full ${usd(selectedPayment.amount, selectedPayment.currency)})`}
                        className="w-full rounded-lg border border-[#d2d2d7] bg-[#FFFFFF] px-3 py-2 text-xs text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#1D6AE5]/50"
                      />
                      <button
                        onClick={() => performAction('refund', selectedPayment.id)}
                        disabled={!!actionLoading || !actionReason.trim()}
                        className="w-full rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-40"
                      >
                        {actionLoading === 'refund'
                          ? 'Processing...'
                          : refundAmount.trim()
                            ? `Refund $${refundAmount}`
                            : 'Full Refund'}
                      </button>
                    </div>
                  )}

                  {/* Mark Resolved */}
                  {(selectedPayment.status === 'failed' || selectedPayment.status === 'disputed') && (
                    <button
                      onClick={() => performAction('mark_resolved', selectedPayment.id)}
                      disabled={!!actionLoading || !actionReason.trim()}
                      className="w-full rounded-lg bg-[#1D6AE5] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#005bb5] disabled:opacity-40"
                    >
                      {actionLoading === 'mark_resolved' ? 'Resolving...' : 'Mark Resolved'}
                    </button>
                  )}
                </div>
              </div>
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
      {status}
    </span>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#86868b]">{label}</span>
      <span className={`text-xs text-[#6e6e73] ${mono ? 'font-mono' : ''} max-w-[180px] truncate`}>
        {value}
      </span>
    </div>
  );
}

function TimelineEntry({
  label,
  time,
  active,
  error: isError,
}: {
  label: string;
  time: string | null;
  active: boolean;
  error?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-2 w-2 rounded-full ${
          active
            ? isError
              ? 'bg-red-500'
              : 'bg-emerald-500'
            : 'bg-[#d2d2d7]'
        }`}
      />
      <span className={`text-xs ${active ? 'text-[#6e6e73]' : 'text-[#86868b]'}`}>
        {label}
      </span>
      <span className="ml-auto text-xs text-[#86868b]">{formatDate(time)}</span>
    </div>
  );
}
