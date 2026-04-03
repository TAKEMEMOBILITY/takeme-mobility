'use client';

import { useState, useEffect, useCallback } from 'react';

// Admin Fleet Dashboard — pending approvals, metrics, actions

export default function AdminFleetPage() {
  const [data, setData] = useState<{
    metrics: { totalOwners: number; activeVehicles: number; activeBookings: number; heldPayouts: number; activeDisputes: number };
    pendingOwners: Array<{ id: string; email: string; status: string; created_at: string }>;
    pendingVehicles: Array<{ id: string; make: string; model: string; year: number; status: string; created_at: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/admin/fleet');
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 15_000); return () => clearInterval(id); }, [fetchData]);

  const adminAction = async (action: string, targetId: string, reason?: string) => {
    await fetch('/api/admin/fleet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, targetId, reason }) });
    fetchData();
  };

  const ago = (ts: string) => { const d = Date.now() - new Date(ts).getTime(); if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`; return `${Math.floor(d / 3_600_000)}h ago`; };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-[#71717a]">Loading fleet data...</div>;

  const m = data?.metrics;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 lg:p-8 text-[#e4e4e7]">
      <h1 className="text-xl font-semibold text-white">Fleet Management</h1>
      <p className="mt-1 text-[13px] text-[#71717a]">EV owner onboarding, vehicle approval, bookings</p>

      {/* Metrics */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: 'Total Owners', value: m?.totalOwners ?? 0 },
          { label: 'Active Vehicles', value: m?.activeVehicles ?? 0 },
          { label: 'Active Bookings', value: m?.activeBookings ?? 0 },
          { label: 'Held Payouts', value: m?.heldPayouts ?? 0 },
          { label: 'Disputes', value: m?.activeDisputes ?? 0 },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#52525b]">{s.label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending Owners */}
      <div className="mt-8">
        <h2 className="text-[15px] font-semibold text-white">Pending owner approvals</h2>
        <div className="mt-3 space-y-2">
          {(data?.pendingOwners ?? []).map(o => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-4">
              <div>
                <p className="text-[14px] font-medium text-white">{o.email}</p>
                <p className="text-[12px] text-[#52525b]">{o.status.replace(/_/g, ' ')} &middot; {ago(o.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => adminAction('approve_owner', o.id)} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[12px] font-medium text-emerald-400">Approve</button>
                <button onClick={() => adminAction('reject_owner', o.id, 'Incomplete documents')} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[12px] font-medium text-red-400">Reject</button>
              </div>
            </div>
          ))}
          {(data?.pendingOwners ?? []).length === 0 && <p className="text-[13px] text-[#52525b]">No pending approvals.</p>}
        </div>
      </div>

      {/* Pending Vehicles */}
      <div className="mt-8">
        <h2 className="text-[15px] font-semibold text-white">Pending vehicle reviews</h2>
        <div className="mt-3 space-y-2">
          {(data?.pendingVehicles ?? []).map(v => (
            <div key={v.id} className="flex items-center justify-between rounded-xl border border-[#1e1e2e] bg-[#0f0f17] p-4">
              <div>
                <p className="text-[14px] font-medium text-white">{v.year} {v.make} {v.model}</p>
                <p className="text-[12px] text-[#52525b]">{ago(v.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => adminAction('approve_vehicle', v.id)} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[12px] font-medium text-emerald-400">Activate</button>
                <button onClick={() => adminAction('reject_vehicle', v.id, 'Does not meet requirements')} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[12px] font-medium text-red-400">Reject</button>
              </div>
            </div>
          ))}
          {(data?.pendingVehicles ?? []).length === 0 && <p className="text-[13px] text-[#52525b]">No pending reviews.</p>}
        </div>
      </div>
    </div>
  );
}
