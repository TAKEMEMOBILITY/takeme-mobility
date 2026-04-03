'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// /ops — Mission Control (Zero Trust Protected)
//
// Accessible: ops_core, exec_founder, super_admin
// Returns 404 to everyone else (proxy.ts enforcement)
// NOT linked in any public nav
// ═══════════════════════════════════════════════════════════════════════════

interface CheckResult {
  service: string;
  status: string;
  latency_ms: number;
  error?: string;
  blast_radius?: string;
}

interface RCA { cause: string; confidence: number; autofix_available: boolean; }
interface MonitorData { status: string; timestamp: string; checks: CheckResult[]; failures: number; rca: RCA | null; }

function StatusDot({ status }: { status: string }) {
  const c = status === 'ok' || status === 'healthy' || status === 'none' ? 'bg-emerald-400'
    : status === 'warn' || status === 'degraded' ? 'bg-amber-400' : 'bg-red-400';
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}

export default function OpsPage() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/monitor');
      if (res.ok) {
        setData(await res.json());
        setLastRefresh(new Date().toISOString());
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const impactColor = data?.status === 'none' || data?.status === 'healthy' ? 'text-emerald-400'
    : data?.status === 'degraded' ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8 text-[#e4e4e7]">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Mission Control</h1>
            <p className="mt-1 text-[13px] text-[#71717a]">
              Ops Center &middot; {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : 'Loading...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[13px] font-medium ${impactColor}`}>
              {data?.status?.toUpperCase() ?? 'LOADING'}
            </span>
            <button
              onClick={() => { setLoading(true); refresh(); }}
              className="rounded-lg bg-[#1e1e2e] px-3 py-1.5 text-[13px] text-[#a1a1aa] hover:text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="mt-20 text-center text-[#71717a]">Connecting to monitoring...</div>
        ) : (
          <div className="mt-6 space-y-4">
            {/* RCA Banner */}
            {data?.rca && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-medium text-red-400">{data.rca.cause}</p>
                    <p className="mt-1 text-[12px] text-[#71717a]">
                      Confidence: {data.rca.confidence}%
                      {data.rca.autofix_available && ' · Auto-fix available'}
                    </p>
                  </div>
                  {data.rca.autofix_available && (
                    <button
                      onClick={() => fetch('/api/monitor/autofix', { method: 'POST' }).then(refresh)}
                      className="rounded-lg bg-amber-500/20 px-4 py-2 text-[13px] font-medium text-amber-400"
                    >
                      Auto-Fix
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Service Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.checks ?? []).map((c) => (
                <div
                  key={c.service}
                  className={`rounded-xl border p-4 ${
                    c.status === 'ok' ? 'border-[#1e1e2e] bg-[#0f0f17]'
                    : c.status === 'warn' ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status={c.status} />
                      <span className="text-[13px] font-medium text-white">{c.service}</span>
                    </div>
                    <span className="text-[12px] tabular-nums text-[#71717a]">{c.latency_ms}ms</span>
                  </div>
                  {c.error && <p className="mt-2 truncate text-[12px] text-red-400">{c.error}</p>}
                  {c.blast_radius && <p className="mt-1 text-[11px] text-[#52525b]">{c.blast_radius}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
