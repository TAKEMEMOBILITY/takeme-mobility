'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// /ops — Mission Control
//
// Full infrastructure monitoring dashboard for the engineering team.
// Auth: ops_core, exec_founder, super_admin (proxy.ts → 404 for everyone else)
// Watermarked + copy-protected via layout.tsx
// Auto-refresh every 30 seconds.
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────

interface CheckResult {
  service: string;
  status: 'ok' | 'warn' | 'error';
  latency_ms: number;
  error?: string;
  blast_radius?: string;
}
interface RCA { cause: string; confidence: number; autofix_available: boolean }
interface MonitorData {
  status: string; timestamp: string; checks: CheckResult[];
  failures: number; rca: RCA | null;
}
interface E2EStep { step: string; status: 'pass' | 'fail' | 'skip'; duration_ms: number; error?: string }
interface E2EData {
  status: string; timestamp: string; steps: E2EStep[];
  summary: { passed: number; failed: number; total: number };
}
interface Capability { name: string; status: 'ok' | 'fail'; latency_ms: number; error?: string }
interface CapData { timestamp: string; capabilities: Record<string, Capability>; all_operational: boolean }
interface PolicyCheck { policy: string; expected: string; actual: string; drifted: boolean }
interface PolicyData { timestamp: string; drift_count: number; total_checks: number; status: string; checks: PolicyCheck[] }
interface AutofixResult { service: string; fix_applied: string; success: boolean; error?: string }
interface AutofixData { fixed: AutofixResult[]; failed: AutofixResult[]; skipped: string[] }
interface LogEntry { id: string; service: string; status: string; latency_ms: number; error: string | null; created_at: string }

// ── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(ts: string): string {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3_600_000)}h ago`;
}

function StatusDot({ s }: { s: string }) {
  const c = s === 'ok' || s === 'pass' || s === 'healthy' || s === 'none' || s === 'compliant'
    ? 'bg-emerald-400' : s === 'warn' || s === 'degraded' ? 'bg-amber-400' : 'bg-red-400';
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function OpsPage() {
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [e2e, setE2e] = useState<E2EData | null>(null);
  const [caps, setCaps] = useState<CapData | null>(null);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autofix, setAutofix] = useState<AutofixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');
  const [autofixRunning, setAutofixRunning] = useState(false);

  const fetchAll = useCallback(async () => {
    const settled = await Promise.allSettled([
      fetch('/api/monitor').then(r => r.ok ? r.json() : null),
      fetch('/api/monitor/e2e').then(r => r.ok ? r.json() : null),
      fetch('/api/monitor/capabilities').then(r => r.ok ? r.json() : null),
      fetch('/api/monitor/policy').then(r => r.ok ? r.json() : null),
      fetch('/api/admin/monitoring/logs').then(r => r.ok ? r.json() : null),
    ]);
    if (settled[0].status === 'fulfilled' && settled[0].value) setMonitor(settled[0].value);
    if (settled[1].status === 'fulfilled' && settled[1].value) setE2e(settled[1].value);
    if (settled[2].status === 'fulfilled' && settled[2].value) setCaps(settled[2].value);
    if (settled[3].status === 'fulfilled' && settled[3].value) setPolicy(settled[3].value);
    if (settled[4].status === 'fulfilled' && settled[4].value) setLogs(settled[4].value);
    setLastRefresh(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const runAutofix = async () => {
    setAutofixRunning(true);
    try {
      const res = await fetch('/api/monitor/autofix', { method: 'POST' });
      if (res.ok) setAutofix(await res.json());
      await fetchAll();
    } finally { setAutofixRunning(false); }
  };

  // ── Derived state ──────────────────────────────────────────────────

  const failures = monitor?.checks.filter(c => c.status === 'error') ?? [];
  const criticalServices = new Set(['supabase_db', 'supabase_auth', 'stripe_api', 'upstash_redis']);
  const hasCritical = failures.some(f => criticalServices.has(f.service));
  const impact = (monitor?.failures ?? 0) === 0 ? 'none' : hasCritical ? 'critical' : 'degraded';

  const impactColor = impact === 'none' ? 'text-emerald-400' : impact === 'degraded' ? 'text-amber-400' : 'text-red-400';
  const impactBg = impact === 'none' ? 'bg-emerald-500/10 border-emerald-500/20' : impact === 'degraded' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  const gateOpen = (monitor?.failures ?? 0) === 0 && (policy?.drift_count ?? 0) === 0;

  if (loading && !monitor) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="text-[13px] text-[#71717a]">Connecting to monitoring...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 lg:p-8 text-[#e4e4e7]">
      <div className="mx-auto max-w-[1400px]">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Mission Control</h1>
            <p className="mt-1 text-[13px] text-[#71717a]">
              Infrastructure monitoring &middot; {lastRefresh ? `Updated ${timeAgo(lastRefresh)}` : '...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runAutofix}
              disabled={autofixRunning}
              className="rounded-lg bg-amber-500/20 px-4 py-2 text-[13px] font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
            >
              {autofixRunning ? 'Fixing...' : 'Run Auto-Fix'}
            </button>
            <button
              onClick={() => { setLoading(true); fetchAll(); }}
              className="rounded-lg bg-[#1e1e2e] px-4 py-2 text-[13px] font-medium text-[#a1a1aa] hover:text-white"
            >
              Refresh
            </button>
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[12px] font-medium text-emerald-400">Live</span>
            </div>
          </div>
        </div>

        {/* ── Row 1: Impact · RCA · Deploy Gate · Rollback ────────── */}
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {/* Customer Impact */}
          <div className={`rounded-xl border p-5 ${impactBg}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">Customer Impact</p>
            <p className={`mt-2 text-2xl font-bold ${impactColor}`}>
              {impact === 'none' ? 'None' : impact === 'degraded' ? 'Degraded' : 'Critical'}
            </p>
            <p className="mt-1 text-[13px] text-[#71717a]">
              {monitor?.failures ?? 0} service{(monitor?.failures ?? 0) !== 1 ? 's' : ''} failing
            </p>
          </div>

          {/* RCA */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">RCA Confidence</p>
            {monitor?.rca ? (
              <>
                <p className="mt-2 text-[14px] font-medium text-white">{monitor.rca.cause}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 rounded-full bg-[#1e1e2e] h-2">
                    <div className="h-2 rounded-full bg-amber-400" style={{ width: `${monitor.rca.confidence}%` }} />
                  </div>
                  <span className="text-[13px] font-bold tabular-nums text-white">{monitor.rca.confidence}%</span>
                </div>
                {monitor.rca.autofix_available && (
                  <span className="mt-2 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">Auto-fix available</span>
                )}
              </>
            ) : (
              <p className="mt-2 text-[14px] text-emerald-400">No issues detected</p>
            )}
          </div>

          {/* Deployment Gate */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">Deployment Gate</p>
            <p className={`mt-2 text-lg font-bold ${gateOpen ? 'text-emerald-400' : 'text-red-400'}`}>
              {gateOpen ? 'CLEAR TO DEPLOY' : 'BLOCKED'}
            </p>
            <p className="mt-1 text-[13px] text-[#71717a]">
              {policy?.drift_count ?? 0} drift · {monitor?.failures ?? 0} failures
            </p>
          </div>

          {/* Rollback Readiness */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">Rollback Readiness</p>
            <p className="mt-2 text-[14px] font-medium text-emerald-400">Ready</p>
            <p className="mt-1 text-[12px] text-[#52525b]">
              Vercel instant rollback available
            </p>
            <a
              href="https://vercel.com/takememobility/takeme-mobility/deployments"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-[12px] text-blue-400 hover:underline"
            >
              View deployments &rarr;
            </a>
          </div>
        </div>

        {/* ── Row 2: Service Health Grid ───────────────────────────── */}
        <div className="mt-6 rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">Service Health</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(monitor?.checks ?? []).map(c => (
              <div
                key={c.service}
                className={`rounded-lg border p-3.5 ${
                  c.status === 'ok' ? 'border-[#1e1e2e] bg-[#0a0a0f]'
                  : c.status === 'warn' ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot s={c.status} />
                    <span className="text-[13px] font-medium text-white">{c.service}</span>
                  </div>
                  <span className="text-[12px] tabular-nums text-[#71717a]">{c.latency_ms}ms</span>
                </div>
                {c.error && <p className="mt-2 truncate text-[12px] text-red-400">{c.error}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Row 3: Capabilities · E2E · Auto-fix ────────────────── */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {/* Capability Checks */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">Capability Checks</p>
            <div className="mt-4 space-y-2">
              {caps ? Object.values(caps.capabilities).map(c => (
                <div key={c.name} className="flex items-center justify-between rounded-lg bg-[#0a0a0f] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <StatusDot s={c.status} />
                    <span className="text-[13px] font-medium text-[#e4e4e7]">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] tabular-nums text-[#52525b]">{c.latency_ms}ms</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>{c.status === 'ok' ? 'OK' : 'FAIL'}</span>
                  </div>
                </div>
              )) : <p className="text-[13px] text-[#52525b]">Loading...</p>}
            </div>
          </div>

          {/* Last E2E Transaction */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">Last E2E Transaction</p>
              {e2e && <span className="text-[11px] text-[#52525b]">{timeAgo(e2e.timestamp)}</span>}
            </div>
            {e2e ? (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <StatusDot s={e2e.status} />
                  <span className={`text-lg font-bold ${e2e.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {e2e.summary.passed}/{e2e.summary.total} passed
                  </span>
                </div>
                <div className="mt-4 space-y-1.5">
                  {e2e.steps.map(s => (
                    <div key={s.step} className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-2">
                        <span className={s.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}>
                          {s.status === 'pass' ? '✓' : '✗'}
                        </span>
                        <span className="text-[#a1a1aa]">{s.step.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="tabular-nums text-[#52525b]">{s.duration_ms}ms</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="mt-3 text-[13px] text-[#52525b]">No E2E data</p>}
          </div>

          {/* Auto-Fix Engine */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">Auto-Fix Engine</p>
            {autofix ? (
              <div className="mt-4 space-y-3">
                {autofix.fixed.length > 0 && (
                  <div>
                    <p className="text-[12px] font-medium text-emerald-400">Fixed ({autofix.fixed.length})</p>
                    {autofix.fixed.map((f, i) => (
                      <p key={i} className="mt-1 text-[12px] text-[#a1a1aa]">✓ {f.service}: {f.fix_applied}</p>
                    ))}
                  </div>
                )}
                {autofix.failed.length > 0 && (
                  <div>
                    <p className="text-[12px] font-medium text-red-400">Failed ({autofix.failed.length})</p>
                    {autofix.failed.map((f, i) => (
                      <p key={i} className="mt-1 text-[12px] text-red-400/70">✗ {f.service}: {f.error}</p>
                    ))}
                  </div>
                )}
                {autofix.skipped.length > 0 && (
                  <p className="text-[12px] text-[#52525b]">
                    Skipped: {autofix.skipped.join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-[13px] text-[#52525b]">No auto-fix run this session</p>
                <p className="mt-2 text-[12px] text-[#3f3f46]">
                  Runs automatically every minute via cron.
                  <br />Manual trigger available above.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Blast Radius · Policy Drift ──────────────────── */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Blast Radius */}
          {failures.length > 0 ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-red-400">Blast Radius</p>
              <div className="mt-3 space-y-2">
                {failures.map(c => (
                  <div key={c.service} className="flex items-start gap-3 text-[13px]">
                    <span className="mt-0.5 shrink-0 font-medium text-red-400">{c.service}</span>
                    <span className="text-[#a1a1aa]">{c.blast_radius ?? 'Impact unknown'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-400">Blast Radius</p>
              <p className="mt-3 text-[14px] text-emerald-400">No active incidents — zero blast radius</p>
            </div>
          )}

          {/* Policy Drift */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">Policy Drift</p>
              {policy && (
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  policy.status === 'compliant' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {policy.drift_count} / {policy.total_checks}
                </span>
              )}
            </div>
            {policy ? (
              <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
                {policy.checks.filter(c => c.drifted).length > 0 ? (
                  policy.checks.filter(c => c.drifted).map((c, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg bg-red-500/5 px-3 py-2 text-[12px]">
                      <span className="mt-0.5 text-red-400">⚠</span>
                      <div>
                        <span className="font-medium text-white">{c.policy}</span>
                        <p className="text-[11px] text-[#52525b]">Expected: {c.expected} · Got: <span className="text-red-400">{c.actual}</span></p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-emerald-400">All policies compliant</p>
                )}
              </div>
            ) : <p className="mt-3 text-[13px] text-[#52525b]">Loading...</p>}
          </div>
        </div>

        {/* ── Row 5: Active Incidents ─────────────────────────────── */}
        {failures.length > 0 && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-red-400">
              Active Incidents ({failures.length})
            </p>
            <div className="mt-3 divide-y divide-red-500/10">
              {failures.map(f => (
                <div key={f.service} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-[14px] font-medium text-white">{f.service}</p>
                    <p className="mt-0.5 text-[12px] text-red-400/80">{f.error}</p>
                  </div>
                  <span className="text-[12px] tabular-nums text-[#52525b]">{f.latency_ms}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 6: Live Log Stream ──────────────────────────────── */}
        <div className="mt-6 rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#71717a]">Live Log Stream</p>
          <div className="mt-4 max-h-72 overflow-y-auto">
            {logs.length > 0 ? (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#1e1e2e] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#3f3f46]">
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Service</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Latency</th>
                    <th className="pb-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]/30">
                  {logs.slice(0, 40).map(l => (
                    <tr key={l.id} className="text-[#a1a1aa]">
                      <td className="py-1.5 pr-4 tabular-nums text-[11px] text-[#3f3f46]">
                        {new Date(l.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-1.5 pr-4 font-medium text-white">{l.service}</td>
                      <td className="py-1.5 pr-4"><StatusDot s={l.status} /></td>
                      <td className="py-1.5 pr-4 tabular-nums text-[12px]">{l.latency_ms}ms</td>
                      <td className="max-w-[200px] truncate py-1.5 text-[11px] text-red-400/60">{l.error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-[13px] text-[#52525b]">No log entries yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
