'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// /security — Security Center (Zero Trust)
//
// Auth: security_owner, super_admin ONLY (proxy.ts → 404)
// Requires MFA. Watermarked + copy-protected via layout.
// Never says "unauthorized" or "forbidden".
// Auto-refresh every 20 seconds.
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string; user_email: string; user_role: string; action: string;
  resource: string; resource_id: string | null; ip_address: string;
  success: boolean; risk_score: number; created_at: string;
  metadata: Record<string, unknown>;
}
interface Session {
  id: string; user_id: string; user_email: string | null; user_role: string | null;
  ip_address: string; device_fingerprint: string; user_agent: string;
  mfa_verified: boolean; created_at: string; last_activity: string;
  expires_at: string; revoked: boolean; revoke_reason: string | null;
}
interface IPEntry {
  id: string; ip_cidr: string; description: string | null;
  allowed_roles: string[] | null; created_at: string; expires_at: string | null;
}
interface UserEntry {
  id: string; email: string; full_name: string | null; role: string;
  mfa_enabled: boolean; locked_until: string | null; last_active_at: string | null;
  failed_attempts: number; created_at: string;
}

type Tab = 'threat' | 'audit' | 'sessions' | 'ip_allowlist' | 'roles' | 'reactions';

// ── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(ts: string): string {
  if (!ts) return '—';
  const d = Date.now() - new Date(ts).getTime();
  if (d < 0) return 'now';
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

function RiskBadge({ score }: { score: number }) {
  const c = score > 75 ? 'bg-red-500/20 text-red-400' : score > 50 ? 'bg-amber-500/20 text-amber-400'
    : score > 25 ? 'bg-blue-500/20 text-blue-400' : 'bg-[#d2d2d7] text-[#86868b]';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${c}`}>{score}</span>;
}

const ROLES = ['user', 'backoffice_staff', 'support_manager', 'ops_core', 'exec_founder', 'security_owner', 'super_admin'] as const;

const INPUT = 'rounded-lg border border-[#d2d2d7] bg-[#FFFFFF] px-3 py-1.5 text-[13px] text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#86868b]';

// ── Page ─────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const [tab, setTab] = useState<Tab>('threat');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ipData, setIpData] = useState<{ entries: IPEntry[]; recentAccessIPs: string[] }>({ entries: [], recentAccessIPs: [] });
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  // Filters
  const [af, setAf] = useState({ user: '', action: '', success: '', minRisk: '' });

  // IP form
  const [newIP, setNewIP] = useState({ cidr: '', desc: '' });

  const fetchAll = useCallback(async () => {
    const r = await Promise.allSettled([
      fetch('/api/security/audit').then(r => r.ok ? r.json() : []),
      fetch('/api/security/sessions').then(r => r.ok ? r.json() : []),
      fetch('/api/security/ip-allowlist').then(r => r.ok ? r.json() : { entries: [], recentAccessIPs: [] }),
      fetch('/api/security/users').then(r => r.ok ? r.json() : []),
    ]);
    if (r[0].status === 'fulfilled') setAudit(r[0].value);
    if (r[1].status === 'fulfilled') setSessions(r[1].value);
    if (r[2].status === 'fulfilled') setIpData(r[2].value);
    if (r[3].status === 'fulfilled') setUsers(r[3].value);
    setLastRefresh(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 20_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Actions ────────────────────────────────────────────────────────

  const revokeSession = async (sessionId: string) => {
    await fetch('/api/security/sessions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, reason: 'admin_revoke' }) });
    fetchAll();
  };
  const revokeAllForUser = async (userId: string) => {
    await fetch('/api/security/sessions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, reason: 'admin_revoke_all' }) });
    fetchAll();
  };
  const addIP = async () => {
    if (!newIP.cidr) return;
    await fetch('/api/security/ip-allowlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip_cidr: newIP.cidr, description: newIP.desc }) });
    setNewIP({ cidr: '', desc: '' });
    fetchAll();
  };
  const deleteIP = async (id: string) => {
    await fetch('/api/security/ip-allowlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    fetchAll();
  };
  const updateUser = async (userId: string, action: string, extra?: Record<string, unknown>) => {
    await fetch('/api/security/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, action, ...extra }) });
    fetchAll();
  };
  const exportCSV = () => {
    const rows = ['Time,Email,Role,Action,Resource,Success,Risk,IP'];
    audit.forEach(e => rows.push(`"${e.created_at}","${e.user_email}","${e.user_role}","${e.action}","${e.resource}",${e.success},${e.risk_score},"${e.ip_address}"`));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    fetch('/api/security/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'export_audit_csv' }) });
  };

  // ── Derived ────────────────────────────────────────────────────────

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const hourAgo = Date.now() - 3_600_000;

  const todayEvents = audit.filter(e => e.created_at >= todayISO);
  const highRiskToday = todayEvents.filter(e => e.risk_score > 60);
  const reactionsToday = todayEvents.filter(e => e.action.startsWith('AUTO_'));
  const lockedAccounts = users.filter(u => u.locked_until && new Date(u.locked_until) > new Date());
  const blockedIPs = ipData.entries.filter(e => e.description === 'AUTO_BLOCKED');
  const activeSessions = sessions.filter(s => !s.revoked);

  const unusualUsers = (() => {
    const fails: Record<string, number> = {};
    audit.forEach(e => {
      if (!e.success && e.user_email && new Date(e.created_at).getTime() > hourAgo) {
        fails[e.user_email] = (fails[e.user_email] ?? 0) + 1;
      }
    });
    return Object.entries(fails).filter(([, c]) => c >= 5).map(([email, count]) => ({ email, count }));
  })();

  const filteredAudit = audit.filter(e => {
    if (af.user && !(e.user_email ?? '').toLowerCase().includes(af.user.toLowerCase())) return false;
    if (af.action && !e.action.toLowerCase().includes(af.action.toLowerCase())) return false;
    if (af.success === 'true' && !e.success) return false;
    if (af.success === 'false' && e.success) return false;
    if (af.minRisk && e.risk_score < Number(af.minRisk)) return false;
    return true;
  });

  const reactions = audit.filter(e => e.action.startsWith('AUTO_')).slice(0, 50);

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'threat', label: 'Threat Summary' },
    { key: 'audit', label: 'Audit Log', badge: highRiskToday.length || undefined },
    { key: 'sessions', label: 'Sessions', badge: activeSessions.length || undefined },
    { key: 'ip_allowlist', label: 'IP Allowlist' },
    { key: 'roles', label: 'Roles & Users' },
    { key: 'reactions', label: 'Reaction Engine', badge: reactionsToday.length || undefined },
  ];

  return (
    <div className="min-h-screen bg-[#FFFFFF] p-6 lg:p-8 text-[#1d1d1f]">
      <style>{`@media print { body { display: none !important; } } .sensitive-data { filter: blur(4px); transition: filter .2s; } .sensitive-data:hover { filter: none; }`}</style>

      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#1d1d1f]">Security Center</h1>
            <p className="mt-1 text-[13px] text-[#86868b]">
              Zero Trust Administration &middot; {lastRefresh ? `Updated ${timeAgo(lastRefresh)}` : '...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[12px] font-medium text-emerald-400">MFA Verified</span>
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[12px] font-medium text-emerald-400">Live</span>
            </div>
          </div>
        </div>

        {/* Unusual activity banner */}
        {unusualUsers.length > 0 && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-[13px] font-medium text-red-400">⚠ Unusual Activity Detected</p>
            {unusualUsers.map(u => (
              <p key={u.email} className="mt-1 text-[12px] text-[#6e6e73]">{u.email}: {u.count} failed attempts in last hour</p>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex gap-0.5 overflow-x-auto border-b border-[#d2d2d7]">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition-colors ${tab === t.key ? 'border-b-2 border-[#1D6AE5] text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#6e6e73]'}`}>
              {t.label}
              {t.badge !== undefined && <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold text-red-400">{t.badge}</span>}
            </button>
          ))}
        </div>

        {loading ? <div className="mt-12 text-center text-[#86868b]">Loading...</div> : (
          <div className="mt-6">

            {/* ═══ THREAT SUMMARY ═══════════════════════════════════════ */}
            {tab === 'threat' && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <ThreatCard label="Audit Events Today" value={todayEvents.length} color="blue" />
                <ThreatCard label="High Risk (>60)" value={highRiskToday.length} color={highRiskToday.length > 0 ? 'red' : 'emerald'} />
                <ThreatCard label="Auto-Reactions" value={reactionsToday.length} color={reactionsToday.length > 0 ? 'amber' : 'emerald'} />
                <ThreatCard label="Accounts Locked" value={lockedAccounts.length} color={lockedAccounts.length > 0 ? 'red' : 'emerald'} />
                <ThreatCard label="Active IP Blocks" value={blockedIPs.length} color={blockedIPs.length > 0 ? 'amber' : 'emerald'} />
              </div>
            )}

            {/* ═══ AUDIT LOG ═══════════════════════════════════════════ */}
            {tab === 'audit' && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <input placeholder="User..." value={af.user} onChange={e => setAf(f => ({ ...f, user: e.target.value }))} className={INPUT} />
                    <input placeholder="Action..." value={af.action} onChange={e => setAf(f => ({ ...f, action: e.target.value }))} className={INPUT} />
                    <select value={af.success} onChange={e => setAf(f => ({ ...f, success: e.target.value }))} className={INPUT}>
                      <option value="">All</option><option value="true">Success</option><option value="false">Failed</option>
                    </select>
                    <input type="number" placeholder="Min risk..." value={af.minRisk} onChange={e => setAf(f => ({ ...f, minRisk: e.target.value }))} className={`${INPUT} w-24`} />
                  </div>
                  <button onClick={exportCSV} className="rounded-lg bg-[#d2d2d7] px-4 py-1.5 text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">Export CSV</button>
                </div>
                <div className="mt-4 max-h-[600px] overflow-auto rounded-xl border border-[#d2d2d7]">
                  <table className="w-full text-left text-[13px]">
                    <thead className="sticky top-0 bg-[#f5f5f7] z-10">
                      <tr className="border-b border-[#d2d2d7] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#86868b]">
                        <th className="px-3 py-2.5">Time</th><th className="px-3 py-2.5">User</th><th className="px-3 py-2.5">Role</th>
                        <th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">Resource</th><th className="px-3 py-2.5">OK</th>
                        <th className="px-3 py-2.5">Risk</th><th className="px-3 py-2.5">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d2d2d7]/30">
                      {filteredAudit.map(e => (
                        <tr key={e.id} className={e.risk_score > 75 ? 'bg-red-500/5' : e.risk_score > 50 ? 'bg-amber-500/5' : ''}>
                          <td className="px-3 py-2 tabular-nums text-[11px] text-[#86868b]">{timeAgo(e.created_at)}</td>
                          <td className="sensitive-data px-3 py-2 text-[#1d1d1f]">{e.user_email || '—'}</td>
                          <td className="px-3 py-2 text-[#86868b]">{e.user_role || '—'}</td>
                          <td className="px-3 py-2 font-medium text-[#1d1d1f]">{e.action}</td>
                          <td className="px-3 py-2 text-[#86868b]">{e.resource}</td>
                          <td className="px-3 py-2"><span className={e.success ? 'text-emerald-400' : 'text-red-400'}>{e.success ? '✓' : '✗'}</span></td>
                          <td className="px-3 py-2"><RiskBadge score={e.risk_score} /></td>
                          <td className="sensitive-data px-3 py-2 text-[11px] text-[#86868b]">{e.ip_address}</td>
                        </tr>
                      ))}
                      {filteredAudit.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[#86868b]">No matching entries</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ ACTIVE SESSIONS ═════════════════════════════════════ */}
            {tab === 'sessions' && (
              <div className="space-y-3">
                {activeSessions.length > 0 ? activeSessions.map(s => {
                  const expired = new Date(s.expires_at) < new Date();
                  const stale = Date.now() - new Date(s.last_activity).getTime() > 30 * 60_000;
                  return (
                    <div key={s.id} className={`rounded-xl border p-4 ${stale ? 'border-amber-500/30 bg-amber-500/5' : 'border-[#d2d2d7] bg-[#f5f5f7]'}`}>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${expired ? 'bg-red-400' : 'bg-emerald-400'}`} />
                            <span className="sensitive-data text-[13px] font-medium text-[#1d1d1f]">{s.user_email ?? s.user_id.slice(0, 12)}</span>
                            <span className="text-[11px] text-[#86868b]">{s.user_role ?? ''}</span>
                            {s.mfa_verified && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">MFA</span>}
                            {stale && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">Stale</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 text-[12px] text-[#86868b]">
                            <span>IP: <span className="sensitive-data text-[#86868b]">{s.ip_address}</span></span>
                            <span>Last active: {timeAgo(s.last_activity)}</span>
                            <span>Created: {timeAgo(s.created_at)}</span>
                            <span>Expires: {timeAgo(s.expires_at)}</span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-[#d2d2d7]">{s.user_agent?.slice(0, 100)}</p>
                        </div>
                        <div className="ml-4 flex shrink-0 gap-2">
                          <button onClick={() => revokeAllForUser(s.user_id)}
                            className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-[11px] font-medium text-amber-400 hover:bg-amber-500/30">Revoke All</button>
                          <button onClick={() => revokeSession(s.id)}
                            className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/30">Revoke</button>
                        </div>
                      </div>
                    </div>
                  );
                }) : <p className="text-center text-[13px] text-[#86868b]">No active sessions</p>}
              </div>
            )}

            {/* ═══ IP ALLOWLIST ═════════════════════════════════════════ */}
            {tab === 'ip_allowlist' && (
              <div>
                {/* Add form */}
                <div className="flex gap-2">
                  <input placeholder="IP or CIDR (e.g. 1.2.3.4/32)" value={newIP.cidr} onChange={e => setNewIP(f => ({ ...f, cidr: e.target.value }))} className={`${INPUT} flex-1`} />
                  <input placeholder="Description" value={newIP.desc} onChange={e => setNewIP(f => ({ ...f, desc: e.target.value }))} className={`${INPUT} flex-1`} />
                  <button onClick={addIP} className="rounded-lg bg-emerald-500/20 px-4 py-1.5 text-[13px] font-medium text-emerald-400 hover:bg-[#005bb5]/30">Add</button>
                </div>

                {/* Entries */}
                <div className="mt-4 space-y-2">
                  {ipData.entries.map(e => (
                    <div key={e.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${e.description === 'AUTO_BLOCKED' ? 'border-red-500/30 bg-red-500/5' : 'border-[#d2d2d7] bg-[#f5f5f7]'}`}>
                      <div>
                        <span className="text-[13px] font-mono font-medium text-[#1d1d1f]">{e.ip_cidr}</span>
                        {e.description && <span className="ml-2 text-[12px] text-[#86868b]">{e.description}</span>}
                        {e.expires_at && <span className="ml-2 text-[11px] text-[#86868b]">Expires: {timeAgo(e.expires_at)}</span>}
                      </div>
                      <button onClick={() => deleteIP(e.id)}
                        className="rounded-lg bg-red-500/20 px-3 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/30">Delete</button>
                    </div>
                  ))}
                  {ipData.entries.length === 0 && <p className="text-center text-[13px] text-[#86868b]">No entries — all IPs allowed by default</p>}
                </div>

                {/* Recent access IPs */}
                {ipData.recentAccessIPs.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">IPs that accessed /ops or /security (24h)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ipData.recentAccessIPs.map(ip => (
                        <span key={ip} className="rounded-full border border-[#d2d2d7] px-3 py-1 text-[12px] font-mono text-[#86868b]">{ip}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ ROLES & USERS ═══════════════════════════════════════ */}
            {tab === 'roles' && (
              <div className="space-y-2">
                {users.map(u => {
                  const locked = u.locked_until && new Date(u.locked_until) > new Date();
                  return (
                    <div key={u.id} className={`rounded-xl border p-4 ${locked ? 'border-red-500/30 bg-red-500/5' : 'border-[#d2d2d7] bg-[#f5f5f7]'}`}>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="sensitive-data text-[13px] font-medium text-[#1d1d1f]">{u.email}</span>
                            {locked && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">LOCKED</span>}
                            {u.mfa_enabled && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">MFA</span>}
                          </div>
                          <p className="mt-0.5 text-[12px] text-[#86868b]">
                            {u.full_name ?? '—'} &middot; Last active: {u.last_active_at ? timeAgo(u.last_active_at) : 'never'} &middot; Fails: {u.failed_attempts}
                          </p>
                        </div>
                        <div className="ml-4 flex shrink-0 items-center gap-2">
                          <select
                            value={u.role}
                            onChange={e => updateUser(u.id, 'change_role', { role: e.target.value })}
                            className={`${INPUT} py-1 text-[12px]`}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          {locked ? (
                            <button onClick={() => updateUser(u.id, 'unlock')}
                              className="rounded-lg bg-emerald-500/20 px-3 py-1 text-[11px] font-medium text-emerald-400 hover:bg-[#005bb5]/30">Unlock</button>
                          ) : (
                            <button onClick={() => updateUser(u.id, 'lock', { lockHours: 24 })}
                              className="rounded-lg bg-red-500/20 px-3 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/30">Lock 24h</button>
                          )}
                          <button onClick={() => updateUser(u.id, 'force_mfa_reset')}
                            className="rounded-lg bg-amber-500/20 px-3 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/30">Reset MFA</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {users.length === 0 && <p className="text-center text-[13px] text-[#86868b]">No users found</p>}
              </div>
            )}

            {/* ═══ REACTION ENGINE LOG ═════════════════════════════════ */}
            {tab === 'reactions' && (
              <div className="space-y-2">
                {reactions.length > 0 ? reactions.map(e => (
                  <div key={e.id} className={`rounded-lg border p-3 ${
                    e.action === 'AUTO_ACCOUNT_LOCK' || e.action === 'AUTO_PATTERN_LOCK' ? 'border-red-500/30 bg-red-500/5'
                    : e.action === 'AUTO_FORCE_LOGOUT' ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-blue-500/30 bg-blue-500/5'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          e.action.includes('LOCK') ? 'bg-red-500/20 text-red-400'
                          : e.action.includes('LOGOUT') ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                        }`}>{e.action}</span>
                        <span className="sensitive-data text-[13px] text-[#6e6e73]">{e.user_email ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <RiskBadge score={e.risk_score} />
                        <span className="text-[11px] text-[#86868b]">{timeAgo(e.created_at)}</span>
                      </div>
                    </div>
                    {e.metadata && typeof e.metadata === 'object' && Object.keys(e.metadata).length > 0 && (
                      <p className="mt-1 truncate text-[11px] text-[#86868b]">
                        {Object.entries(e.metadata).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                  </div>
                )) : <p className="text-center text-[13px] text-[#86868b]">No automated reactions recorded</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function ThreatCard({ label, value, color }: { label: string; value: number; color: 'emerald' | 'blue' | 'amber' | 'red' }) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
  };
  const textColor = { emerald: 'text-emerald-400', blue: 'text-blue-400', amber: 'text-amber-400', red: 'text-red-400' };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${textColor[color]}`}>{value}</p>
    </div>
  );
}
