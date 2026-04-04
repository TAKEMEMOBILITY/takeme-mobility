'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Link from 'next/link';

interface AuditEntry {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 50;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

const ACTION_COLORS: Record<string, string> = {
  suspend_user: 'text-red-400 bg-red-400/10',
  suspend_driver: 'text-red-400 bg-red-400/10',
  ban_device: 'text-red-400 bg-red-400/10',
  activate_driver: 'text-emerald-400 bg-emerald-400/10',
  approve_driver: 'text-emerald-400 bg-emerald-400/10',
  reject_driver: 'text-amber-400 bg-amber-400/10',
  cancel_ride: 'text-amber-400 bg-amber-400/10',
  refund_ride: 'text-blue-400 bg-blue-400/10',
  add_user_note: 'text-blue-400 bg-blue-400/10',
  add_driver_note: 'text-blue-400 bg-blue-400/10',
};

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterAdminEmail, setFilterAdminEmail] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [offset, setOffset] = useState(0);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      if (filterAction) params.set('action', filterAction);
      if (filterAdminEmail) params.set('admin_email', filterAdminEmail);
      if (filterDateFrom) params.set('from', new Date(filterDateFrom).toISOString());
      if (filterDateTo) params.set('to', new Date(filterDateTo + 'T23:59:59').toISOString());

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [offset, filterAction, filterAdminEmail, filterDateFrom, filterDateTo]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyFilters = () => {
    setOffset(0);
    fetchAudit();
  };

  const clearFilters = () => {
    setFilterAction('');
    setFilterAdminEmail('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setOffset(0);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  // Collect unique actions from results for the filter dropdown
  const actionOptions = [
    'suspend_user', 'suspend_driver', 'activate_driver', 'approve_driver',
    'reject_driver', 'cancel_ride', 'refund_ride', 'ban_device',
    'add_user_note', 'add_driver_note',
  ];

  return (
    <div className="min-h-screen bg-[#FFFFFF] p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs text-[#86868b]">
          <Link href="/admin" className="hover:text-[#6e6e73] transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-[#1d1d1f]">Audit Log</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Audit Log</h1>
          <p className="mt-1 text-xs text-[#86868b]">
            {data ? `${data.total} total entries` : 'Loading...'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Action</label>
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                className="rounded-lg border border-[#d2d2d7] bg-[#FFFFFF] px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]/50"
              >
                <option value="">All Actions</option>
                {actionOptions.map(a => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Admin Email</label>
              <input
                type="text"
                value={filterAdminEmail}
                onChange={e => setFilterAdminEmail(e.target.value)}
                placeholder="Search admin..."
                className="rounded-lg border border-[#d2d2d7] bg-[#FFFFFF] px-3 py-2 text-xs text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#0071e3]/50 w-48"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="rounded-lg border border-[#d2d2d7] bg-[#FFFFFF] px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">To</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="rounded-lg border border-[#d2d2d7] bg-[#FFFFFF] px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]/50"
              />
            </div>

            <button
              onClick={applyFilters}
              className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-[#005bb5]/30 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={clearFilters}
              className="rounded-lg border border-[#d2d2d7] px-4 py-2 text-xs font-medium text-[#86868b] hover:text-[#6e6e73] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#d2d2d7]">
                  {['Timestamp', 'Admin', 'Action', 'Target Type', 'Target ID', 'Details', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0071e3] border-t-transparent" />
                        <span className="text-sm text-[#86868b]">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : data?.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#86868b]">
                      No audit entries found
                    </td>
                  </tr>
                ) : (
                  data?.entries.map(entry => {
                    const isExpanded = expandedRows.has(entry.id);
                    const actionColor = ACTION_COLORS[entry.action] ?? 'text-[#6e6e73] bg-[#86868b]/10';
                    return (
                      <Fragment key={entry.id}>
                        <tr className="border-b border-[#d2d2d7]/50 transition-colors hover:bg-[#d2d2d7]/30">
                          <td className="px-4 py-3 text-xs text-[#6e6e73] whitespace-nowrap">{fmtDate(entry.created_at)}</td>
                          <td className="px-4 py-3 text-xs text-[#1d1d1f]">{entry.admin_email}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${actionColor}`}>
                              {entry.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#6e6e73] capitalize">{entry.target_type}</td>
                          <td className="px-4 py-3 text-xs font-mono text-[#86868b]">
                            {entry.target_id ? entry.target_id.slice(0, 12) + '...' : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#86868b] max-w-[200px] truncate">
                            {Object.keys(entry.details).length > 0
                              ? JSON.stringify(entry.details).slice(0, 60) + (JSON.stringify(entry.details).length > 60 ? '...' : '')
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {Object.keys(entry.details).length > 0 && (
                              <button
                                onClick={() => toggleExpand(entry.id)}
                                className="text-[11px] font-medium text-[#0071e3] hover:text-[#005bb5] transition-colors"
                              >
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-[#d2d2d7]/50">
                            <td colSpan={7} className="px-6 py-4 bg-[#FFFFFF]">
                              <pre className="whitespace-pre-wrap break-all text-xs text-[#6e6e73] font-mono leading-relaxed">
                                {JSON.stringify(entry.details, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-[#d2d2d7] px-5 py-4">
              <p className="text-xs text-[#86868b]">
                Showing {offset + 1}--{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="rounded-lg border border-[#d2d2d7] px-3 py-1.5 text-xs font-medium text-[#86868b] hover:text-[#6e6e73] transition-colors disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="flex items-center px-2 text-xs text-[#86868b]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= data.total}
                  className="rounded-lg border border-[#d2d2d7] px-3 py-1.5 text-xs font-medium text-[#86868b] hover:text-[#6e6e73] transition-colors disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
