'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// /admin/monitoring — Mission Control Dashboard
//
// Live monitoring dashboard with auto-refresh every 30 seconds.
// Fetches from all monitor APIs and displays unified status view.
// ═══════════════════════════════════════════════════════════════════════════

interface CheckResult {
  service: string;
  status: 'ok' | 'warn' | 'error';
  latency_ms: number;
  error?: string;
  blast_radius?: string;
}

interface RCA {
  cause: string;
  confidence: number;
  autofix_available: boolean;
}

interface MonitorData {
  status: string;
  timestamp: string;
  checks: CheckResult[];
  failures: number;
  rca: RCA | null;
}

interface E2EStep {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  duration_ms: number;
  error?: string;
}

interface E2EData {
  status: string;
  timestamp: string;
  steps: E2EStep[];
  summary: { passed: number; failed: number; total: number };
}

interface Capability {
  name: string;
  status: 'ok' | 'fail';
  latency_ms: number;
  error?: string;
}

interface CapData {
  timestamp: string;
  capabilities: Record<string, Capability>;
  all_operational: boolean;
}

interface PolicyCheck {
  policy: string;
  expected: string;
  actual: string;
  drifted: boolean;
}

interface PolicyData {
  timestamp: string;
  drift_count: number;
  total_checks: number;
  status: string;
  checks: PolicyCheck[];
}

interface LogEntry {
  id: string;
  service: string;
  status: string;
  latency_ms: number;
  error: string | null;
  created_at: string;
}

const CRON_SECRET = typeof window === 'undefined' ? '' : '';

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'ok' || status === 'pass' || status === 'healthy' || status === 'none' || status === 'compliant'
    ? 'bg-emerald-400' : status === 'warn' || status === 'degraded'
    ? 'bg-amber-400' : 'bg-red-400';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export default function MonitoringPage() {
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [e2e, setE2e] = useState<E2EData | null>(null);
  const [caps, setCaps] = useState<CapData | null>(null);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');
  const [autofixRunning, setAutofixRunning] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [monRes, e2eRes, capRes, polRes, logRes] = await Promise.allSettled([
        fetch('/api/monitor').then((r) => r.ok ? r.json() : null),
        fetch('/api/monitor/e2e').then((r) => r.ok ? r.json() : null),
        fetch('/api/monitor/capabilities').then((r) => r.ok ? r.json() : null),
        fetch('/api/monitor/policy').then((r) => r.ok ? r.json() : null),
        fetch('/api/admin/monitoring/logs').then((r) => r.ok ? r.json() : null),
      ]);

      if (monRes.status === 'fulfilled' && monRes.value) setMonitor(monRes.value);
      if (e2eRes.status === 'fulfilled' && e2eRes.value) setE2e(e2eRes.value);
      if (capRes.status === 'fulfilled' && capRes.value) setCaps(capRes.value);
      if (polRes.status === 'fulfilled' && polRes.value) setPolicy(polRes.value);
      if (logRes.status === 'fulfilled' && logRes.value) setLogs(logRes.value);

      setLastRefresh(new Date().toISOString());
    } catch (e) {
      console.error('[monitoring] Fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const runAutofix = async () => {
    setAutofixRunning(true);
    try {
      const res = await fetch('/api/monitor/autofix', { method: 'POST' });
      if (res.ok) {
        await fetchAll(); // Refresh after fix
      }
    } finally {
      setAutofixRunning(false);
    }
  };

  const impactColor = monitor?.status === 'none' || monitor?.status === 'healthy'
    ? 'text-emerald-400' : monitor?.status === 'degraded'
    ? 'text-amber-400' : 'text-red-400';

  const impactBg = monitor?.status === 'none' || monitor?.status === 'healthy'
    ? 'bg-emerald-500/10 border-emerald-500/20' : monitor?.status === 'degraded'
    ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">Mission Control</h1>
          <p className="mt-1 text-[13px] text-[#86868b]">
            Production monitoring &middot; {lastRefresh ? `Updated ${timeAgo(lastRefresh)}` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAutofix}
            disabled={autofixRunning}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-[13px] font-medium text-amber-400 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
          >
            {autofixRunning ? 'Running...' : 'Run Auto-Fix'}
          </button>
          <button
            onClick={() => { setLoading(true); fetchAll(); }}
            className="rounded-lg bg-[#d2d2d7] px-4 py-2 text-[13px] font-medium text-[#6e6e73] transition-colors hover:text-[#1d1d1f]"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && !monitor ? (
        <div className="mt-20 text-center text-[#86868b]">Loading monitoring data...</div>
      ) : (
        <div className="mt-6 space-y-6">

          {/* ═══ TOP ROW: Impact + RCA + Deployment Gate ════════════════ */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Customer Impact */}
            <div className={`rounded-xl border p-5 ${impactBg}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Customer Impact</p>
              <p className={`mt-2 text-2xl font-bold ${impactColor}`}>
                {monitor?.status === 'none' || monitor?.status === 'healthy' ? 'None' : monitor?.status === 'degraded' ? 'Degraded' : 'Critical'}
              </p>
              <p className="mt-1 text-[13px] text-[#86868b]">
                {monitor?.failures ?? 0} service{(monitor?.failures ?? 0) !== 1 ? 's' : ''} failing
              </p>
            </div>

            {/* RCA */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Root Cause Analysis</p>
              {monitor?.rca ? (
                <>
                  <p className="mt-2 text-[14px] font-medium text-[#1d1d1f]">{monitor.rca.cause}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-[13px] text-[#86868b]">
                      Confidence: <span className="font-medium text-[#1d1d1f]">{monitor.rca.confidence}%</span>
                    </span>
                    {monitor.rca.autofix_available && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                        Auto-fix available
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[14px] text-emerald-400">No issues detected</p>
              )}
            </div>

            {/* Deployment Gate */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Deployment Gate</p>
              <p className={`mt-2 text-lg font-bold ${(monitor?.failures ?? 0) === 0 && (policy?.drift_count ?? 0) === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(monitor?.failures ?? 0) === 0 && (policy?.drift_count ?? 0) === 0 ? 'CLEAR TO DEPLOY' : 'BLOCKED'}
              </p>
              <p className="mt-1 text-[13px] text-[#86868b]">
                {policy?.drift_count ?? 0} policy drift{(policy?.drift_count ?? 0) !== 1 ? 's' : ''} &middot; {monitor?.failures ?? 0} failures
              </p>
            </div>
          </div>

          {/* ═══ SERVICE HEALTH GRID ═══════════════════════════════════ */}
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Service Health</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(monitor?.checks ?? []).map((c) => (
                <div
                  key={c.service}
                  className={`rounded-lg border p-3.5 ${
                    c.status === 'ok' ? 'border-[#d2d2d7] bg-[#FFFFFF]'
                    : c.status === 'warn' ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status={c.status} />
                      <span className="text-[13px] font-medium text-[#1d1d1f]">{c.service}</span>
                    </div>
                    <span className="text-[12px] tabular-nums text-[#86868b]">{c.latency_ms}ms</span>
                  </div>
                  {c.error && (
                    <p className="mt-2 truncate text-[12px] text-red-400">{c.error}</p>
                  )}
                  {c.blast_radius && (
                    <p className="mt-1 text-[11px] text-[#86868b]">{c.blast_radius}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ═══ CAPABILITIES + E2E ROW ════════════════════════════════ */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Capability Checks */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Capability Checks</p>
              <div className="mt-4 space-y-2">
                {caps ? Object.values(caps.capabilities).map((c) => (
                  <div key={c.name} className="flex items-center justify-between rounded-lg bg-[#FFFFFF] px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <StatusDot status={c.status} />
                      <span className="text-[13px] font-medium text-[#1d1d1f]">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] tabular-nums text-[#86868b]">{c.latency_ms}ms</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        c.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {c.status === 'ok' ? 'Operational' : 'Down'}
                      </span>
                    </div>
                  </div>
                )) : (
                  <p className="text-[13px] text-[#86868b]">Loading...</p>
                )}
              </div>
            </div>

            {/* Last E2E Transaction */}
            <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Last E2E Transaction</p>
                {e2e && <span className="text-[12px] text-[#86868b]">{timeAgo(e2e.timestamp)}</span>}
              </div>
              {e2e ? (
                <>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusDot status={e2e.status} />
                    <span className={`text-lg font-bold ${e2e.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {e2e.summary.passed}/{e2e.summary.total} passed
                    </span>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {e2e.steps.map((s) => (
                      <div key={s.step} className="flex items-center justify-between text-[13px]">
                        <div className="flex items-center gap-2">
                          <span className={s.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}>
                            {s.status === 'pass' ? '✓' : '✗'}
                          </span>
                          <span className="text-[#6e6e73]">{s.step}</span>
                        </div>
                        <span className="tabular-nums text-[#86868b]">{s.duration_ms}ms</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-[13px] text-[#86868b]">No E2E data yet</p>
              )}
            </div>
          </div>

          {/* ═══ POLICY DRIFT ══════════════════════════════════════════ */}
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Policy Drift Report</p>
              {policy && (
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  policy.status === 'compliant' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {policy.drift_count} drift{policy.drift_count !== 1 ? 's' : ''} / {policy.total_checks} checks
                </span>
              )}
            </div>
            {policy ? (
              <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
                {policy.checks.filter((c) => c.drifted).length > 0 ? (
                  policy.checks.filter((c) => c.drifted).map((c, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-red-500/5 px-4 py-2.5 text-[13px]">
                      <span className="mt-0.5 text-red-400">⚠</span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-[#1d1d1f]">{c.policy}</span>
                        <p className="mt-0.5 text-[12px] text-[#86868b]">
                          Expected: {c.expected} &middot; Actual: <span className="text-red-400">{c.actual}</span>
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-emerald-400">All policies compliant</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-[#86868b]">Loading...</p>
            )}
          </div>

          {/* ═══ LIVE LOG STREAM ═══════════════════════════════════════ */}
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Live Log Stream</p>
            <div className="mt-4 max-h-80 overflow-y-auto">
              {logs.length > 0 ? (
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#d2d2d7] text-[11px] font-semibold uppercase tracking-[0.1em] text-[#86868b]">
                      <th className="pb-2 pr-4">Time</th>
                      <th className="pb-2 pr-4">Service</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Latency</th>
                      <th className="pb-2">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d2d2d7]/50">
                    {logs.map((log) => (
                      <tr key={log.id} className="text-[#6e6e73]">
                        <td className="py-1.5 pr-4 tabular-nums text-[12px] text-[#86868b]">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                        <td className="py-1.5 pr-4 font-medium text-[#1d1d1f]">{log.service}</td>
                        <td className="py-1.5 pr-4">
                          <StatusDot status={log.status} />
                        </td>
                        <td className="py-1.5 pr-4 tabular-nums">{log.latency_ms}ms</td>
                        <td className="max-w-[200px] truncate py-1.5 text-[12px] text-red-400/70">{log.error ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[13px] text-[#86868b]">No log entries yet</p>
              )}
            </div>
          </div>

          {/* ═══ BLAST RADIUS ═════════════════════════════════════════ */}
          {monitor && monitor.checks.some((c) => c.blast_radius) && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-red-400">Blast Radius</p>
              <div className="mt-3 space-y-2">
                {monitor.checks.filter((c) => c.blast_radius).map((c) => (
                  <div key={c.service} className="flex items-start gap-3 text-[13px]">
                    <span className="mt-0.5 font-medium text-red-400">{c.service}</span>
                    <span className="text-[#6e6e73]">{c.blast_radius}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
