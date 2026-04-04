'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// /ops — Mission Control (Final Form)
//
// Auth: ops_core, exec_founder, super_admin (proxy.ts → 404)
// Watermarked + copy-protected via layout.
// Auto-refresh 30s. Simulation mode available.
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────

interface Check { service: string; status: 'ok' | 'warn' | 'error'; latency_ms: number; error?: string; blast_radius?: string }
interface Hypothesis { cause: string; confidence: number; autofixAvailable: boolean; manualSteps: string }
interface MonitorData { status: string; timestamp: string; checks: Check[]; failures: number; rca: Hypothesis[] | null }
interface E2EStep { step: string; status: string; duration_ms: number; error?: string }
interface E2ERun { timestamp: string; pass: boolean; totalDuration: number; steps: E2EStep[] }
interface E2EData { status: string; timestamp: string; steps: E2EStep[]; summary: { passed: number; failed: number; total: number }; history: E2ERun[]; stats: { successRate: number; p50: number; p95: number; p99: number; failurePattern: string | null; trend: string } }
interface Cap { name: string; status: 'ok' | 'fail'; latency_ms: number; error?: string }
interface CapData { capabilities: Record<string, Cap>; all_operational: boolean }
interface PolicyCheck { policy: string; expected: string; actual: string; drifted: boolean }
interface Attribution { policy: string; lastChangedBy: string | null; lastChangedAt: string | null; source: string; delta: string }
interface PolicyChange { who: string; action: string; resource: string; when: string }
interface PolicyData { drift_count: number; total_checks: number; status: string; checks: PolicyCheck[]; attributions: Attribution[]; recentChanges: PolicyChange[] }
interface LogEntry { id: string; service: string; status: string; latency_ms: number; error: string | null; created_at: string }
interface SimResult { scenario: string; description: string; status: string; checks: Check[]; failures: number; projectedMode: string; projectedReactions: string[]; rca: Hypothesis[] | null; expiresIn: number }
interface InvMetric { name: string; violations_today: number; violations_7d: number; violations_30d: number; near_misses_today: number; shadow_violations: number; avg_recovery_time_ms: number; last_violation_at: string | null; mttr_7d: number; current_status: 'healthy' | 'near_miss' | 'violated' | 'recovering' }
interface ShadowStatus { enabled: boolean; startedAt: number | null; hoursActive: number; readyToEnforce: boolean }

type SystemMode = 'NORMAL' | 'DEGRADED' | 'DEFENSIVE' | 'LOCKDOWN';
const MODE_COLORS: Record<SystemMode, string> = { NORMAL: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', DEGRADED: 'bg-amber-500/20 text-amber-400 border-amber-500/30', DEFENSIVE: 'bg-orange-500/20 text-orange-400 border-orange-500/30', LOCKDOWN: 'bg-red-500/20 text-red-400 border-red-500/30' };

// ── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(ts: string): string { const d = Date.now() - new Date(ts).getTime(); if (d < 60_000) return `${Math.floor(d / 1000)}s ago`; if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`; return `${Math.floor(d / 3_600_000)}h ago`; }
function Dot({ s }: { s: string }) { const c = s === 'ok' || s === 'pass' || s === 'healthy' || s === 'none' ? 'bg-emerald-400' : s === 'warn' || s === 'degraded' ? 'bg-amber-400' : 'bg-red-400'; return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />; }

// ── Page ─────────────────────────────────────────────────────────────────

export default function OpsPage() {
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [e2e, setE2e] = useState<E2EData | null>(null);
  const [caps, setCaps] = useState<CapData | null>(null);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mode, setMode] = useState<SystemMode>('NORMAL');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');
  const [autofixRunning, setAutofixRunning] = useState(false);
  const [simMode, setSimMode] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simCountdown, setSimCountdown] = useState(0);
  const [simScenario, setSimScenario] = useState('ses_down');
  const [expandedRCA, setExpandedRCA] = useState(-1);
  const [expandedE2E, setExpandedE2E] = useState(-1);
  const [invMetrics, setInvMetrics] = useState<InvMetric[]>([]);
  const [shadowStatuses, setShadowStatuses] = useState<Record<string, ShadowStatus>>({});

  const fetchAll = useCallback(async () => {
    const r = await Promise.allSettled([
      fetch('/api/monitor').then(r => r.ok ? r.json() : null),
      fetch('/api/monitor/e2e').then(r => r.ok ? r.json() : null),
      fetch('/api/monitor/capabilities').then(r => r.ok ? r.json() : null),
      fetch('/api/monitor/policy').then(r => r.ok ? r.json() : null),
      fetch('/api/admin/monitoring/logs').then(r => r.ok ? r.json() : null),
      fetch('/api/ops/mode').then(r => r.ok ? r.json() : { mode: 'NORMAL' }),
      fetch('/api/invariants/metrics').then(r => r.ok ? r.json() : { metrics: [] }),
      fetch('/api/invariants/shadow').then(r => r.ok ? r.json() : { statuses: {} }),
    ]);
    if (r[0].status === 'fulfilled' && r[0].value) setMonitor(r[0].value);
    if (r[1].status === 'fulfilled' && r[1].value) setE2e(r[1].value);
    if (r[2].status === 'fulfilled' && r[2].value) setCaps(r[2].value);
    if (r[3].status === 'fulfilled' && r[3].value) setPolicy(r[3].value);
    if (r[4].status === 'fulfilled' && r[4].value) setLogs(r[4].value);
    if (r[5].status === 'fulfilled' && r[5].value) setMode(r[5].value.mode as SystemMode);
    if (r[6].status === 'fulfilled' && r[6].value) setInvMetrics(r[6].value.metrics ?? []);
    if (r[7].status === 'fulfilled' && r[7].value) setShadowStatuses(r[7].value.statuses ?? {});
    setLastRefresh(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30_000); return () => clearInterval(id); }, [fetchAll]);

  // Simulation countdown
  useEffect(() => {
    if (simCountdown <= 0) { if (simResult) setSimResult(null); return; }
    const id = setTimeout(() => setSimCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [simCountdown, simResult]);

  const changeMode = async (newMode: SystemMode) => {
    await fetch('/api/ops/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: newMode, reason: 'manual' }) });
    setMode(newMode);
    fetchAll();
  };

  const runAutofix = async () => { setAutofixRunning(true); try { await fetch('/api/monitor/autofix', { method: 'POST' }); await fetchAll(); } finally { setAutofixRunning(false); } };

  const runSimulation = async () => {
    const res = await fetch('/api/monitor/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: simScenario }) });
    if (res.ok) { const d = await res.json(); setSimResult(d); setSimCountdown(d.expiresIn ?? 60); }
  };

  // Active data source (real or simulated)
  const activeChecks = simResult ? simResult.checks : (monitor?.checks ?? []);
  const activeRCA = simResult ? simResult.rca : monitor?.rca;
  const activeFailures = activeChecks.filter(c => c.status === 'error');
  const activeStatus = simResult ? simResult.status : (monitor?.status ?? 'none');

  const criticalSet = new Set(['supabase_db', 'supabase_auth', 'stripe_api', 'upstash_redis']);
  const hasCritical = activeFailures.some(f => criticalSet.has(f.service));
  const impact = activeFailures.length === 0 ? 'none' : hasCritical ? 'critical' : 'degraded';
  const impactColor = impact === 'none' ? 'text-emerald-400' : impact === 'degraded' ? 'text-amber-400' : 'text-red-400';
  const impactBg = impact === 'none' ? 'bg-emerald-500/10 border-emerald-500/20' : impact === 'degraded' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';
  const gateOpen = activeFailures.length === 0 && (policy?.drift_count ?? 0) === 0 && mode === 'NORMAL';

  if (loading && !monitor) return <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1D6AE5] border-t-transparent" /></div>;

  return (
    <div className={`min-h-screen bg-[#FFFFFF] text-[#1d1d1f] ${simMode ? 'ring-2 ring-amber-400/40 ring-inset' : ''}`}>
      {/* LOCKDOWN banner */}
      {mode === 'LOCKDOWN' && (
        <div className="animate-pulse bg-red-600 py-2 text-center text-[14px] font-bold text-white tracking-wider">
          ⚠ SYSTEM LOCKDOWN — All non-read operations blocked ⚠
        </div>
      )}

      <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#1d1d1f]">Mission Control</h1>
            <p className="mt-1 text-[13px] text-[#86868b]">
              {simMode ? 'SIMULATION MODE' : 'Infrastructure monitoring'} &middot; {lastRefresh ? timeAgo(lastRefresh) : '...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Simulation toggle */}
            <button onClick={() => { setSimMode(!simMode); if (simMode) { setSimResult(null); setSimCountdown(0); } }}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${simMode ? 'bg-amber-500/30 text-amber-400' : 'bg-[#d2d2d7] text-[#86868b] hover:text-[#6e6e73]'}`}>
              {simMode ? 'Exit Sim' : 'Simulation'}
            </button>
            <button onClick={runAutofix} disabled={autofixRunning} className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-[12px] font-medium text-amber-400 disabled:opacity-50">
              {autofixRunning ? 'Fixing...' : 'Auto-Fix'}
            </button>
            <button onClick={() => { setLoading(true); fetchAll(); }} className="rounded-lg bg-[#d2d2d7] px-3 py-1.5 text-[12px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">Refresh</button>
            {/* Mode badge */}
            <span className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold ${MODE_COLORS[mode]} ${mode !== 'NORMAL' ? 'animate-pulse' : ''}`}>{mode}</span>
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /><span className="text-[12px] font-medium text-emerald-400">Live</span>
            </div>
          </div>
        </div>

        {/* ── Simulation bar ──────────────────────────────────────── */}
        {simMode && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <select value={simScenario} onChange={e => setSimScenario(e.target.value)}
                  className="rounded-lg border border-[#d2d2d7] bg-[#FFFFFF] px-3 py-1.5 text-[13px] text-[#1d1d1f] outline-none">
                  <option value="ses_down">SES Down</option>
                  <option value="db_latency">DB High Latency</option>
                  <option value="auth_failure">Auth Failure</option>
                  <option value="redis_down">Redis Down</option>
                  <option value="full_outage">Full Outage</option>
                  <option value="ddos">DDoS Attack</option>
                </select>
                <button onClick={runSimulation} className="rounded-lg bg-amber-500/20 px-4 py-1.5 text-[13px] font-medium text-amber-400 hover:bg-amber-500/30">Run Simulation</button>
              </div>
              {simCountdown > 0 && <span className="text-[13px] tabular-nums text-amber-400">Simulation ends in: {simCountdown}s</span>}
            </div>
            {simResult && (
              <div className="mt-3 flex flex-wrap gap-4 text-[12px]">
                <span className="text-[#6e6e73]">Scenario: <span className="text-[#1d1d1f]">{simResult.description}</span></span>
                <span className="text-[#6e6e73]">Projected mode: <span className={`font-bold ${simResult.projectedMode === 'LOCKDOWN' ? 'text-red-400' : simResult.projectedMode === 'DEFENSIVE' ? 'text-orange-400' : 'text-amber-400'}`}>{simResult.projectedMode}</span></span>
                <span className="text-[#6e6e73]">Would trigger: <span className="text-amber-400">{simResult.projectedReactions.join(', ') || 'none'}</span></span>
              </div>
            )}
          </div>
        )}

        {/* ── Row 1: Automated Decision Engine ════════════════════ */}
        <div className="mt-6 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Automated Decision Engine</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <DecisionCard label="System Mode" value={mode} color={mode === 'NORMAL' ? 'emerald' : mode === 'DEGRADED' ? 'amber' : mode === 'DEFENSIVE' ? 'orange' : 'red'}
              actions={(['NORMAL', 'DEGRADED', 'DEFENSIVE', 'LOCKDOWN'] as SystemMode[]).filter(m => m !== mode).map(m => ({ label: m, onClick: () => changeMode(m) }))} />
            <DecisionCard label="Deploy" value={gateOpen ? 'CLEAR' : mode !== 'NORMAL' ? 'HOLD' : 'BLOCKED'} color={gateOpen ? 'emerald' : 'red'} />
            <DecisionCard label="Traffic" value={mode === 'LOCKDOWN' ? 'REDIRECT' : mode === 'DEFENSIVE' ? 'HOLD' : 'ACTIVE'} color={mode === 'NORMAL' ? 'emerald' : mode === 'LOCKDOWN' ? 'red' : 'amber'} />
            <DecisionCard label="Retry Strategy" value={mode === 'DEFENSIVE' ? 'CIRCUIT_OPEN' : mode === 'DEGRADED' ? 'AGGRESSIVE' : 'NORMAL'} color={mode === 'NORMAL' ? 'emerald' : mode === 'DEFENSIVE' ? 'red' : 'amber'} />
            <DecisionCard label="Auto-Fix" value={mode === 'LOCKDOWN' ? 'OFF' : mode === 'DEFENSIVE' ? 'SUSPENDED' : 'ON'} color={mode === 'NORMAL' ? 'emerald' : mode === 'LOCKDOWN' ? 'red' : 'amber'} />
          </div>
        </div>

        {/* ── Row 2: Impact · RCA · Gate · Rollback ═══════════════ */}
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div className={`rounded-xl border p-5 ${impactBg}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Customer Impact</p>
            <p className={`mt-2 text-2xl font-bold ${impactColor}`}>{impact === 'none' ? 'None' : impact === 'degraded' ? 'Degraded' : 'Critical'}</p>
            <p className="mt-1 text-[13px] text-[#86868b]">{activeFailures.length} failing</p>
          </div>
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Deployment Gate</p>
            <p className={`mt-2 text-lg font-bold ${gateOpen ? 'text-emerald-400' : 'text-red-400'}`}>{gateOpen ? 'CLEAR' : 'BLOCKED'}</p>
            <p className="mt-1 text-[13px] text-[#86868b]">{policy?.drift_count ?? 0} drift · {activeFailures.length} fails · mode: {mode}</p>
          </div>
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Rollback</p>
            <p className="mt-2 text-[14px] font-medium text-emerald-400">Ready</p>
            <a href="https://vercel.com/takememobility/takeme-mobility/deployments" target="_blank" rel="noopener noreferrer" className="mt-1 text-[12px] text-blue-400 hover:underline">Vercel deployments &rarr;</a>
          </div>
          {/* E2E Quick Stats */}
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">E2E Health</p>
            {e2e?.stats ? (
              <>
                <p className={`mt-2 text-lg font-bold ${e2e.stats.successRate >= 80 ? 'text-emerald-400' : e2e.stats.successRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{e2e.stats.successRate}% pass</p>
                <p className="mt-1 text-[12px] text-[#86868b]">P50: {e2e.stats.p50}ms · P95: {e2e.stats.p95}ms · Trend: {e2e.stats.trend === 'improving' ? '↑' : e2e.stats.trend === 'degrading' ? '↓' : '→'} {e2e.stats.trend}</p>
              </>
            ) : <p className="mt-2 text-[13px] text-[#86868b]">No data</p>}
          </div>
        </div>

        {/* ── Row 3: Alternative Hypotheses (RCA) ════════════════ */}
        {activeRCA && activeRCA.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Root Cause Analysis — Alternative Hypotheses</p>
            <div className="mt-4 space-y-2">
              {activeRCA.map((h, i) => (
                <div key={i} className={`rounded-lg border p-3 ${i === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-[#d2d2d7] bg-[#FFFFFF]'}`}>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedRCA(expandedRCA === i ? -1 : i)}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[12px] font-bold tabular-nums text-[#86868b] shrink-0">{i === 0 ? 'Root Cause' : `Alt ${i}`}</span>
                      <span className="text-[13px] font-medium text-[#1d1d1f] truncate">{h.cause}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <div className="w-20 rounded-full bg-[#d2d2d7] h-1.5"><div className={`h-1.5 rounded-full ${h.confidence >= 50 ? 'bg-amber-400' : h.confidence >= 20 ? 'bg-blue-400' : 'bg-[#86868b]'}`} style={{ width: `${h.confidence}%` }} /></div>
                      <span className="text-[12px] font-bold tabular-nums text-[#1d1d1f] w-10 text-right">{h.confidence}%</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${h.autofixAvailable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#d2d2d7] text-[#86868b]'}`}>{h.autofixAvailable ? 'AUTO' : 'MANUAL'}</span>
                      <span className="text-[#86868b]">{expandedRCA === i ? '▾' : '▸'}</span>
                    </div>
                  </div>
                  {expandedRCA === i && (
                    <div className="mt-2 rounded bg-[#FFFFFF] p-2 text-[12px] font-mono text-[#86868b]">
                      {h.manualSteps}
                      {h.autofixAvailable && <button onClick={runAutofix} className="ml-3 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">Apply Fix</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 4: Service Grid ════════════════════════════════ */}
        <div className="mt-4 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Service Health</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeChecks.map(c => (
              <div key={c.service} className={`rounded-lg border p-3 ${c.status === 'ok' ? 'border-[#d2d2d7] bg-[#FFFFFF]' : c.status === 'warn' ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Dot s={c.status} /><span className="text-[13px] font-medium text-[#1d1d1f]">{c.service}</span></div>
                  <span className="text-[12px] tabular-nums text-[#86868b]">{c.latency_ms}ms</span>
                </div>
                {c.error && <p className="mt-1.5 truncate text-[11px] text-red-400">{c.error}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Row 5: Caps · E2E History · Policy Drift ═══════════ */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* Capabilities */}
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Capabilities</p>
            <div className="mt-3 space-y-1.5">
              {caps ? Object.values(caps.capabilities).map(c => (
                <div key={c.name} className="flex items-center justify-between rounded bg-[#FFFFFF] px-3 py-2">
                  <div className="flex items-center gap-2"><Dot s={c.status} /><span className="text-[13px] text-[#1d1d1f]">{c.name}</span></div>
                  <span className="text-[11px] tabular-nums text-[#86868b]">{c.latency_ms}ms</span>
                </div>
              )) : <p className="text-[13px] text-[#86868b]">Loading...</p>}
            </div>
          </div>

          {/* E2E Transaction History */}
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">E2E Transaction History</p>
            {e2e?.stats ? (
              <>
                <div className="mt-3 flex items-center gap-4 text-[12px]">
                  <span className="text-[#6e6e73]">Rate: <span className="font-bold text-[#1d1d1f]">{e2e.stats.successRate}%</span></span>
                  <span className="text-[#86868b]">P50: {e2e.stats.p50}ms</span>
                  <span className="text-[#86868b]">P95: {e2e.stats.p95}ms</span>
                  <span className="text-[#86868b]">P99: {e2e.stats.p99}ms</span>
                </div>
                {e2e.stats.failurePattern && <p className="mt-1 text-[11px] text-red-400/80">{e2e.stats.failurePattern}</p>}
                <div className="mt-3 space-y-1">
                  {(e2e.history ?? []).slice(0, 8).map((run, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between cursor-pointer rounded bg-[#FFFFFF] px-3 py-1.5 text-[12px]" onClick={() => setExpandedE2E(expandedE2E === i ? -1 : i)}>
                        <div className="flex items-center gap-2">
                          <span className={run.pass ? 'text-emerald-400' : 'text-red-400'}>{run.pass ? '✓' : '✗'}</span>
                          <span className="tabular-nums text-[#86868b]">{timeAgo(run.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-[#86868b]">{run.totalDuration}ms</span>
                          <span className="text-[#d2d2d7]">{expandedE2E === i ? '▾' : '▸'}</span>
                        </div>
                      </div>
                      {expandedE2E === i && (
                        <div className="ml-6 mt-1 space-y-0.5 text-[11px]">
                          {run.steps.map(s => (
                            <div key={s.step} className="flex items-center justify-between text-[#86868b]">
                              <span><span className={s.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}>{s.status === 'pass' ? '✓' : '✗'}</span> {s.step.replace(/_/g, ' ')}</span>
                              <span className="tabular-nums">{s.duration_ms}ms</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="mt-3 text-[13px] text-[#86868b]">No E2E data</p>}
          </div>

          {/* Policy Drift with Attribution */}
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Policy Drift</p>
              {policy && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${policy.status === 'compliant' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{policy.drift_count}/{policy.total_checks}</span>}
            </div>
            {policy ? (
              <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                {policy.attributions.length > 0 ? policy.attributions.map((a, i) => (
                  <div key={i} className="rounded bg-red-500/5 p-2 text-[12px]">
                    <p className="font-medium text-[#1d1d1f]">{a.policy}</p>
                    <p className="mt-0.5 text-[11px] text-[#86868b]">{a.delta}</p>
                    <p className="mt-0.5 text-[11px] text-[#86868b]">
                      Changed by: <span className="text-[#86868b]">{a.lastChangedBy ?? 'unknown'}</span>
                      {a.lastChangedAt && <> · {timeAgo(a.lastChangedAt)}</>}
                      · Source: {a.source}
                    </p>
                  </div>
                )) : policy.drift_count === 0 ? (
                  <p className="text-[13px] text-emerald-400">All compliant</p>
                ) : (
                  policy.checks.filter(c => c.drifted).slice(0, 5).map((c, i) => (
                    <div key={i} className="rounded bg-red-500/5 p-2 text-[12px]">
                      <span className="font-medium text-[#1d1d1f]">{c.policy}</span>
                      <p className="text-[11px] text-[#86868b]">Expected: {c.expected} → Got: <span className="text-red-400">{c.actual}</span></p>
                    </div>
                  ))
                )}
                {/* Recent changes timeline */}
                {policy.recentChanges && policy.recentChanges.length > 0 && (
                  <div className="mt-3 border-t border-[#d2d2d7] pt-2">
                    <p className="text-[10px] font-semibold uppercase text-[#86868b]">Recent Changes</p>
                    {policy.recentChanges.map((c, i) => (
                      <p key={i} className="mt-1 text-[11px] text-[#86868b]">{c.who ?? '?'} · {c.action} · {timeAgo(c.when)}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : <p className="mt-3 text-[13px] text-[#86868b]">Loading...</p>}
          </div>
        </div>

        {/* ── Row 6: Blast Radius + Incidents ════════════════════ */}
        {activeFailures.length > 0 && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-red-400">Active Incidents — Blast Radius</p>
            <div className="mt-3 divide-y divide-red-500/10">
              {activeFailures.map(f => (
                <div key={f.service} className="flex items-start justify-between py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-[13px] font-medium text-[#1d1d1f]">{f.service}</p>
                    <p className="mt-0.5 text-[11px] text-red-400/80">{f.error}</p>
                    {f.blast_radius && <p className="mt-0.5 text-[11px] text-[#86868b]">{f.blast_radius}</p>}
                  </div>
                  <span className="text-[12px] tabular-nums text-[#86868b]">{f.latency_ms}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 7: Invariant Health + Shadow Mode ════════════ */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Invariant Health */}
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Invariant Health</p>
            <div className="mt-3 space-y-1.5">
              {invMetrics.length > 0 ? invMetrics.map(m => (
                <div key={m.name} className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  m.current_status === 'violated' ? 'bg-red-500/5' : m.current_status === 'near_miss' ? 'bg-amber-500/5' : m.current_status === 'recovering' ? 'bg-blue-500/5' : 'bg-[#FFFFFF]'
                }`}>
                  <div className="flex items-center gap-2">
                    <Dot s={m.current_status === 'healthy' ? 'ok' : m.current_status === 'near_miss' ? 'warn' : 'error'} />
                    <span className="text-[13px] font-medium text-[#1d1d1f]">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    {m.violations_today > 0 && <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-bold text-red-400">{m.violations_today} today</span>}
                    {m.near_misses_today > 0 && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-bold text-amber-400">{m.near_misses_today} near</span>}
                    <span className="text-[#86868b]">7d: {m.violations_7d}</span>
                    {m.avg_recovery_time_ms > 0 && <span className="text-[#86868b]">MTTR: {m.avg_recovery_time_ms}ms</span>}
                  </div>
                </div>
              )) : <p className="text-[13px] text-[#86868b]">No metrics data</p>}
            </div>
          </div>

          {/* Shadow Mode */}
          <div className="rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Shadow Mode</p>
            <div className="mt-3 space-y-1.5">
              {Object.entries(shadowStatuses).map(([name, s]) => (
                <div key={name} className="flex items-center justify-between rounded-lg bg-[#FFFFFF] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.enabled ? 'bg-amber-400' : 'bg-[#d2d2d7]'}`} />
                    <span className="text-[13px] font-medium text-[#1d1d1f]">{name}</span>
                    {s.enabled && <span className="text-[11px] text-amber-400">{s.hoursActive}h active</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {s.readyToEnforce && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Ready to enforce</span>}
                    <button
                      onClick={async () => {
                        await fetch('/api/invariants/shadow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invariant: name, enabled: !s.enabled }) });
                        fetchAll();
                      }}
                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${s.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#d2d2d7] text-[#86868b] hover:text-[#6e6e73]'}`}
                    >
                      {s.enabled ? 'Promote' : 'Enable Shadow'}
                    </button>
                  </div>
                </div>
              ))}
              {Object.keys(shadowStatuses).length === 0 && <p className="text-[13px] text-[#86868b]">Loading...</p>}
            </div>
          </div>
        </div>

        {/* ── Row 8: Live Log Stream ════════════════════════════ */}
        <div className="mt-4 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Live Log Stream</p>
          <div className="mt-3 max-h-56 overflow-y-auto">
            {logs.length > 0 ? (
              <table className="w-full text-left text-[12px]">
                <thead><tr className="border-b border-[#d2d2d7] text-[10px] font-semibold uppercase text-[#d2d2d7]">
                  <th className="pb-1.5 pr-3">Time</th><th className="pb-1.5 pr-3">Service</th><th className="pb-1.5 pr-3">Status</th><th className="pb-1.5 pr-3">Latency</th><th className="pb-1.5">Error</th>
                </tr></thead>
                <tbody className="divide-y divide-[#d2d2d7]/20">
                  {logs.slice(0, 30).map(l => (
                    <tr key={l.id} className="text-[#86868b]">
                      <td className="py-1 pr-3 tabular-nums text-[11px] text-[#d2d2d7]">{new Date(l.created_at).toLocaleTimeString()}</td>
                      <td className="py-1 pr-3 text-[#1d1d1f]">{l.service}</td>
                      <td className="py-1 pr-3"><Dot s={l.status} /></td>
                      <td className="py-1 pr-3 tabular-nums">{l.latency_ms}ms</td>
                      <td className="max-w-[180px] truncate py-1 text-[11px] text-red-400/50">{l.error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-[13px] text-[#86868b]">No entries</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function DecisionCard({ label, value, color, actions }: { label: string; value: string; color: string; actions?: { label: string; onClick: () => void }[] }) {
  const tc: Record<string, string> = { emerald: 'text-emerald-400', amber: 'text-amber-400', orange: 'text-orange-400', red: 'text-red-400' };
  const bg: Record<string, string> = { emerald: 'bg-emerald-500/10', amber: 'bg-amber-500/10', orange: 'bg-orange-500/10', red: 'bg-red-500/10' };
  return (
    <div className={`rounded-lg border border-[#d2d2d7] ${bg[color] ?? 'bg-[#FFFFFF]'} p-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">{label}</p>
      <p className={`mt-1.5 text-[15px] font-bold ${tc[color] ?? 'text-[#1d1d1f]'}`}>{value}</p>
      {actions && actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {actions.map(a => (
            <button key={a.label} onClick={a.onClick} className="rounded bg-[#d2d2d7] px-2 py-0.5 text-[10px] font-medium text-[#86868b] hover:text-[#1d1d1f]">{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
