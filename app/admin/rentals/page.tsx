'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME ADMIN — EV Rentals Management
// Stats, filterable table, slide-in detail panel with actions.
// Auto-refreshes every 15 seconds.
// ═══════════════════════════════════════════════════════════════════════════

interface Addon {
  name: string;
  pricePerDay: number;
}

interface Rental {
  id: string;
  user_id: string;
  user_email: string;
  vehicle_key: string;
  vehicle_name: string;
  category: string;
  daily_rate: number;
  total_days: number;
  subtotal: number;
  addons: Addon[] | null;
  addons_total: number;
  total_amount: number;
  currency: string;
  pickup_date: string;
  return_date: string;
  pickup_location: string;
  status: string;
  stripe_payment_intent: string | null;
  stripe_session_id: string | null;
  confirmation_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  revenue: number;
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400',
  confirmed: 'bg-blue-500/15 text-blue-400',
  active: 'bg-emerald-500/15 text-emerald-400',
  completed: 'bg-green-500/15 text-green-400',
  cancelled: 'bg-red-500/15 text-red-400',
  refunded: 'bg-violet-500/15 text-violet-400',
};

const usd = (n: number) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDate(iso: string | null) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

export default function AdminRentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, pending: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<string>('all');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Detail panel
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const fetchRentals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('status', tab);
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const res = await fetch(`/api/admin/rentals?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRentals(data.rentals ?? []);
      setTotal(data.total ?? 0);
      if (data.stats) setStats(data.stats);
      setError('');
    } catch {
      setError('Failed to load rentals');
    } finally {
      setLoading(false);
    }
  }, [tab, offset]);

  // Initial fetch and tab change
  useEffect(() => {
    setLoading(true);
    setOffset(0);
  }, [tab]);

  useEffect(() => {
    fetchRentals();
  }, [fetchRentals]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchRentals, 15000);
    return () => clearInterval(interval);
  }, [fetchRentals]);

  const openDetail = (rental: Rental) => {
    setSelectedRental(rental);
    setPanelOpen(true);
  };

  const performAction = async (action: string, rentalId: string, reason?: string) => {
    setActionLoading(action);
    try {
      const res = await fetch('/api/admin/rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rentalId, reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(`Action failed: ${d.error}`);
      } else {
        await fetchRentals();
        // Refresh detail panel with updated data
        if (selectedRental && selectedRental.id === rentalId) {
          const updated = (await res.json().catch(() => null));
          if (updated?.status) {
            setSelectedRental({ ...selectedRental, status: updated.status });
          }
        }
      }
    } catch {
      alert('Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const STAT_CARDS = [
    { label: 'Total Rentals', value: String(stats.total), color: 'text-[#e4e4e7]' },
    { label: 'Active', value: String(stats.active), color: 'text-emerald-400' },
    { label: 'Revenue', value: usd(stats.revenue), color: 'text-green-400' },
    { label: 'Pending', value: String(stats.pending), color: 'text-amber-400' },
  ];

  return (
    <div className="flex h-full bg-[#0a0a0f]">
      {/* Main content */}
      <div className={`flex-1 overflow-y-auto p-6 transition-all ${panelOpen ? 'mr-[520px]' : ''}`}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#e4e4e7]">EV Rentals</h1>
          <p className="text-sm text-[#71717a] mt-1">Manage vehicle rental bookings</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {STAT_CARDS.map((s) => (
            <div
              key={s.label}
              className="bg-[#13131b] rounded-xl border border-[#1e1e2e] p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#52525b]">
                {s.label}
              </p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Status filter tabs */}
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

        {/* Rentals table */}
        <div className="bg-[#13131b] rounded-xl border border-[#1e1e2e] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#71717a]">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#71717a] border-t-emerald-500 mr-3" />
              Loading rentals...
            </div>
          ) : rentals.length === 0 ? (
            <div className="py-20 text-center text-[#52525b] text-sm">No rentals found</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['ID', 'Vehicle', 'Customer', 'Dates', 'Location', 'Total', 'Status', 'Created'].map(
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
                {rentals.map((rental) => (
                  <tr
                    key={rental.id}
                    onClick={() => openDetail(rental)}
                    className="border-b border-[#1e1e2e]/50 cursor-pointer transition-colors hover:bg-[#1e1e2e]/30"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-[#71717a]">
                      {rental.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa]">
                      <div className="font-medium text-[#e4e4e7]">{rental.vehicle_name}</div>
                      <div className="text-[10px] text-[#52525b]">{rental.category}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa]">
                      {rental.user_email}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa] whitespace-nowrap">
                      {fmtDate(rental.pickup_date)} - {fmtDate(rental.return_date)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a1a1aa] max-w-[150px] truncate">
                      {rental.pickup_location}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-[#e4e4e7]">
                      {usd(Number(rental.total_amount))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          STATUS_CLASSES[rental.status] ?? 'bg-zinc-500/15 text-zinc-400'
                        }`}
                      >
                        {rental.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#52525b] whitespace-nowrap">
                      {fmtTime(rental.created_at)}
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
      {panelOpen && selectedRental && (
        <div className="fixed right-0 top-0 bottom-0 w-[520px] bg-[#0a0a0f] border-l border-[#1e1e2e] overflow-y-auto z-50 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1e1e2e] bg-[#0a0a0f] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#e4e4e7]">Rental Detail</h2>
              <span className="font-mono text-[10px] text-[#52525b]">{selectedRental.id}</span>
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

          <div className="p-5 space-y-5">
            {/* Status + action buttons */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  STATUS_CLASSES[selectedRental.status] ?? 'bg-zinc-500/15 text-zinc-400'
                }`}
              >
                {selectedRental.status}
              </span>
              <div className="flex gap-2 flex-wrap">
                {!['completed', 'cancelled', 'refunded'].includes(selectedRental.status) && (
                  <button
                    onClick={() => {
                      const reason = prompt('Cancellation reason (optional):');
                      performAction('cancel_rental', selectedRental.id, reason ?? undefined);
                    }}
                    disabled={actionLoading === 'cancel_rental'}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'cancel_rental' ? '...' : 'Cancel'}
                  </button>
                )}
                {['confirmed', 'active', 'completed'].includes(selectedRental.status) && (
                  <button
                    onClick={() => performAction('refund_rental', selectedRental.id)}
                    disabled={actionLoading === 'refund_rental'}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'refund_rental' ? '...' : 'Refund'}
                  </button>
                )}
                {selectedRental.status === 'confirmed' && (
                  <button
                    onClick={() => performAction('mark_active', selectedRental.id)}
                    disabled={actionLoading === 'mark_active'}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'mark_active' ? '...' : 'Mark Active'}
                  </button>
                )}
                {selectedRental.status === 'active' && (
                  <button
                    onClick={() => performAction('mark_completed', selectedRental.id)}
                    disabled={actionLoading === 'mark_completed'}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'mark_completed' ? '...' : 'Mark Completed'}
                  </button>
                )}
              </div>
            </div>

            {/* Vehicle info */}
            <Card title="Vehicle">
              <div className="space-y-2">
                <Row label="Name" value={selectedRental.vehicle_name} highlight />
                <Row label="Category" value={selectedRental.category} />
                <Row label="Vehicle Key" value={selectedRental.vehicle_key} />
              </div>
            </Card>

            {/* Booking details */}
            <Card title="Booking">
              <div className="space-y-2">
                <Row label="Confirmation" value={selectedRental.confirmation_code ?? '--'} highlight />
                <Row label="Pickup" value={fmtDate(selectedRental.pickup_date)} />
                <Row label="Return" value={fmtDate(selectedRental.return_date)} />
                <Row label="Duration" value={`${selectedRental.total_days} day${selectedRental.total_days !== 1 ? 's' : ''}`} />
                <Row label="Location" value={selectedRental.pickup_location} />
                <Row label="Customer" value={selectedRental.user_email} />
              </div>
            </Card>

            {/* Pricing breakdown */}
            <Card title="Pricing">
              <div className="space-y-2">
                <Row label="Daily Rate" value={usd(Number(selectedRental.daily_rate))} />
                <Row label="Subtotal" value={`${usd(Number(selectedRental.subtotal))} (${selectedRental.total_days} days)`} />
                {Number(selectedRental.addons_total) > 0 && (
                  <Row label="Add-ons Total" value={usd(Number(selectedRental.addons_total))} />
                )}
                <div className="border-t border-[#1e1e2e] pt-2 mt-2">
                  <Row label="Total" value={`${selectedRental.currency.toUpperCase()} ${usd(Number(selectedRental.total_amount))}`} highlight />
                </div>
              </div>
            </Card>

            {/* Add-ons list */}
            {selectedRental.addons && selectedRental.addons.length > 0 && (
              <Card title="Add-ons">
                <div className="space-y-2">
                  {selectedRental.addons.map((addon, i) => (
                    <Row
                      key={i}
                      label={addon.name}
                      value={`${usd(addon.pricePerDay)}/day`}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Stripe info */}
            <Card title="Payment">
              <div className="space-y-2">
                {selectedRental.stripe_payment_intent ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#71717a]">Payment Intent</span>
                    <a
                      href={`https://dashboard.stripe.com/payments/${selectedRental.stripe_payment_intent}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-mono text-[11px] underline"
                    >
                      {selectedRental.stripe_payment_intent.slice(0, 24)}...
                    </a>
                  </div>
                ) : (
                  <Row label="Payment Intent" value="--" />
                )}
                {selectedRental.stripe_session_id && (
                  <Row label="Session ID" value={selectedRental.stripe_session_id.slice(0, 24) + '...'} />
                )}
              </div>
            </Card>

            {/* Notes */}
            {selectedRental.notes && (
              <Card title="Notes">
                <p className="text-xs text-[#a1a1aa] whitespace-pre-wrap">{selectedRental.notes}</p>
              </Card>
            )}

            {/* Timestamps */}
            <Card title="Timestamps">
              <div className="space-y-2">
                <Row label="Created" value={fmtTime(selectedRental.created_at)} />
                <Row label="Updated" value={fmtTime(selectedRental.updated_at)} />
              </div>
            </Card>
          </div>
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
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#71717a]">{label}</span>
      <span className={highlight ? 'font-semibold text-[#e4e4e7]' : 'text-[#a1a1aa]'}>
        {value}
      </span>
    </div>
  );
}
