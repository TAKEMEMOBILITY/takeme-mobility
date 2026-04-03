'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// /security — Security Center (Zero Trust Protected)
//
// Accessible: security_owner, super_admin ONLY
// Returns 404 to everyone else (proxy.ts enforcement)
// Requires IP allowlist + MFA
// NOT linked anywhere in nav
// ═══════════════════════════════════════════════════════════════════════════

interface AuditEntry {
  id: string;
  user_email: string;
  user_role: string;
  action: string;
  resource: string;
  resource_id: string | null;
  ip_address: string;
  success: boolean;
  risk_score: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface Session {
  id: string;
  user_id: string;
  ip_address: string;
  device_fingerprint: string;
  user_agent: string;
  mfa_verified: boolean;
  created_at: string;
  last_activity: string;
  revoked: boolean;
  revoke_reason: string | null;
}

type Tab = 'audit' | 'sessions' | 'ip_allowlist' | 'roles';

function timeAgo(ts: string): string {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3_600_000)}h ago`;
}

function RiskBadge({ score }: { score: number }) {
  const color = score > 75 ? 'bg-red-500/20 text-red-400'
    : score > 50 ? 'bg-amber-500/20 text-amber-400'
    : score > 25 ? 'bg-blue-500/20 text-blue-400'
    : 'bg-[#1e1e2e] text-[#52525b]';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${color}`}>{score}</span>;
}

export default function SecurityPage() {
  const [tab, setTab] = useState<Tab>('audit');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', resource: '', success: '' });

  const fetchData = useCallback(async () => {
    try {
      const [auditRes, sessRes] = await Promise.allSettled([
        fetch('/api/security/audit').then(r => r.ok ? r.json() : []),
        fetch('/api/security/sessions').then(r => r.ok ? r.json() : []),
      ]);
      if (auditRes.status === 'fulfilled') setAudit(auditRes.value);
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const revokeSession = async (sessionId: string) => {
    await fetch('/api/security/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, reason: 'admin_revoke' }),
    });
    fetchData();
  };

  const exportCSV = async () => {
    const rows = ['Time,Email,Role,Action,Resource,Success,Risk,IP'];
    audit.forEach(e => {
      rows.push(`${e.created_at},${e.user_email},${e.user_role},${e.action},${e.resource},${e.success},${e.risk_score},${e.ip_address}`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    // Log export
    fetch('/api/security/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export_audit_csv' }),
    });
  };

  const filteredAudit = audit.filter(e => {
    if (filters.action && !e.action.includes(filters.action)) return false;
    if (filters.resource && !e.resource.includes(filters.resource)) return false;
    if (filters.success === 'true' && !e.success) return false;
    if (filters.success === 'false' && e.success) return false;
    return true;
  });

  // Unusual activity detection
  const unusualUsers = (() => {
    const hourAgo = Date.now() - 3_600_000;
    const failsByUser: Record<string, number> = {};
    audit.forEach(e => {
      if (!e.success && new Date(e.created_at).getTime() > hourAgo) {
        failsByUser[e.user_email] = (failsByUser[e.user_email] ?? 0) + 1;
      }
    });
    return Object.entries(failsByUser).filter(([, c]) => c >= 10).map(([email, count]) => ({ email, count }));
  })();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'audit', label: 'Audit Log' },
    { key: 'sessions', label: 'Active Sessions' },
    { key: 'ip_allowlist', label: 'IP Allowlist' },
    { key: 'roles', label: 'Role Management' },
  ];

  return (
    <div className="security-watermark min-h-screen bg-[#0a0a0f] p-8 text-[#e4e4e7]">
      {/* Anti-print CSS */}
      <style>{`@media print { body { display: none !important; } }`}</style>

      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Security Center</h1>
            <p className="mt-1 text-[13px] text-[#71717a]">Zero Trust Administration</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[12px] font-medium text-emerald-400">
              MFA Verified
            </span>
          </div>
        </div>

        {/* Unusual Activity Alert */}
        {unusualUsers.length > 0 && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-[13px] font-medium text-red-400">⚠ Unusual Activity Detected</p>
            {unusualUsers.map(u => (
              <p key={u.email} className="mt-1 text-[12px] text-[#a1a1aa]">
                {u.email}: {u.count} failed attempts in last hour
              </p>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex gap-1 border-b border-[#1e1e2e]">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-[13px] font-medium transition-colors ${
                tab === t.key ? 'border-b-2 border-emerald-400 text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-12 text-center text-[#71717a]">Loading security data...</div>
        ) : (
          <div className="mt-6">

            {/* ═══ AUDIT LOG TAB ═══ */}
            {tab === 'audit' && (
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <input
                      placeholder="Filter action..."
                      value={filters.action}
                      onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
                      className="rounded-lg border border-[#1e1e2e] bg-[#0f0f17] px-3 py-1.5 text-[13px] text-white placeholder-[#52525b] outline-none focus:border-[#3f3f46]"
                    />
                    <input
                      placeholder="Filter resource..."
                      value={filters.resource}
                      onChange={e => setFilters(f => ({ ...f, resource: e.target.value }))}
                      className="rounded-lg border border-[#1e1e2e] bg-[#0f0f17] px-3 py-1.5 text-[13px] text-white placeholder-[#52525b] outline-none focus:border-[#3f3f46]"
                    />
                    <select
                      value={filters.success}
                      onChange={e => setFilters(f => ({ ...f, success: e.target.value }))}
                      className="rounded-lg border border-[#1e1e2e] bg-[#0f0f17] px-3 py-1.5 text-[13px] text-white outline-none"
                    >
                      <option value="">All</option>
                      <option value="true">Success</option>
                      <option value="false">Failed</option>
                    </select>
                  </div>
                  <button
                    onClick={exportCSV}
                    className="rounded-lg bg-[#1e1e2e] px-4 py-1.5 text-[13px] font-medium text-[#a1a1aa] hover:text-white"
                  >
                    Export CSV
                  </button>
                </div>

                <div className="mt-4 max-h-[600px] overflow-y-auto rounded-xl border border-[#1e1e2e]">
                  <table className="w-full text-left text-[13px]">
                    <thead className="sticky top-0 bg-[#0f0f17]">
                      <tr className="border-b border-[#1e1e2e] text-[11px] font-semibold uppercase tracking-[0.1em] text-[#52525b]">
                        <th className="px-4 py-2.5">Time</th>
                        <th className="px-4 py-2.5">User</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5">Action</th>
                        <th className="px-4 py-2.5">Resource</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Risk</th>
                        <th className="px-4 py-2.5">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e1e2e]/50">
                      {filteredAudit.map(e => (
                        <tr key={e.id} className={e.risk_score > 75 ? 'bg-red-500/5' : e.risk_score > 50 ? 'bg-amber-500/5' : ''}>
                          <td className="px-4 py-2 tabular-nums text-[12px] text-[#52525b]">{timeAgo(e.created_at)}</td>
                          <td className="sensitive-data px-4 py-2 text-white">{e.user_email || '—'}</td>
                          <td className="px-4 py-2 text-[#71717a]">{e.user_role || '—'}</td>
                          <td className="px-4 py-2 font-medium text-white">{e.action}</td>
                          <td className="px-4 py-2 text-[#a1a1aa]">{e.resource}</td>
                          <td className="px-4 py-2">
                            <span className={e.success ? 'text-emerald-400' : 'text-red-400'}>
                              {e.success ? '✓' : '✗'}
                            </span>
                          </td>
                          <td className="px-4 py-2"><RiskBadge score={e.risk_score} /></td>
                          <td className="sensitive-data px-4 py-2 text-[12px] text-[#52525b]">{e.ip_address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ ACTIVE SESSIONS TAB ═══ */}
            {tab === 'sessions' && (
              <div className="space-y-3">
                {sessions.filter(s => !s.revoked).map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="sensitive-data text-[13px] font-medium text-white">{s.user_id.slice(0, 8)}...</span>
                        {s.mfa_verified && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">MFA</span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] text-[#52525b]">
                        IP: <span className="sensitive-data">{s.ip_address}</span> &middot;
                        Last active: {timeAgo(s.last_activity)} &middot;
                        Created: {timeAgo(s.created_at)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#3f3f46] break-all">{s.user_agent?.slice(0, 80)}</p>
                    </div>
                    <button
                      onClick={() => revokeSession(s.id)}
                      className="shrink-0 rounded-lg bg-red-500/20 px-3 py-1.5 text-[12px] font-medium text-red-400 hover:bg-red-500/30"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
                {sessions.filter(s => !s.revoked).length === 0 && (
                  <p className="text-center text-[13px] text-[#71717a]">No active sessions</p>
                )}
              </div>
            )}

            {/* ═══ IP ALLOWLIST TAB ═══ */}
            {tab === 'ip_allowlist' && (
              <div>
                <p className="text-[13px] text-[#71717a]">
                  Manage IP addresses allowed to access /ops and /security routes.
                  Add entries via the Supabase dashboard or API.
                </p>
                <div className="mt-4 rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-6 text-center text-[13px] text-[#52525b]">
                  IP allowlist managed via database. Use Supabase SQL Editor to add entries.
                </div>
              </div>
            )}

            {/* ═══ ROLE MANAGEMENT TAB ═══ */}
            {tab === 'roles' && (
              <div>
                <p className="text-[13px] text-[#71717a]">
                  Role assignments are managed via database. Only security_owner and super_admin can modify roles.
                </p>
                <div className="mt-4 space-y-2">
                  {['user', 'backoffice_staff', 'support_manager', 'ops_core', 'exec_founder', 'security_owner', 'super_admin'].map(role => (
                    <div key={role} className="flex items-center justify-between rounded-lg border border-[#1e1e2e] bg-[#0f0f17] px-4 py-3">
                      <span className="text-[13px] font-medium text-white">{role}</span>
                      <span className="text-[12px] text-[#52525b]">
                        {role === 'super_admin' ? 'Full access (logged)' :
                         role === 'security_owner' ? 'Security + audit + IP mgmt' :
                         role === 'exec_founder' ? 'Dashboard + monitoring + admin' :
                         role === 'ops_core' ? 'Monitoring + drivers + payments' :
                         role === 'support_manager' ? 'Drivers + riders + payments + reports' :
                         role === 'backoffice_staff' ? 'Drivers (read) + riders (read)' :
                         'Standard user — no admin access'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
