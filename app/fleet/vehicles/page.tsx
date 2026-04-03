'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// Owner vehicle dashboard — shows onboarding progress + vehicle list

interface Progress {
  step: number; status: string; profileComplete: boolean; kycComplete: boolean;
  insuranceUploaded: boolean; masterAgreementSigned: boolean; vehicleCreated: boolean;
  vehicleDocumentsComplete: boolean; adminApproved: boolean; missingItems: string[];
}

export default function FleetVehiclesPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [vehicles, setVehicles] = useState<Array<{ id: string; make: string; model: string; year: number; status: string; daily_rate_cents: number }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [progRes, vehRes] = await Promise.allSettled([
      fetch('/api/fleet/owners').then(r => r.ok ? r.json() : null),
      fetch('/api/fleet/vehicles?owner=mine').then(r => r.ok ? r.json() : []),
    ]);
    if (progRes.status === 'fulfilled' && progRes.value) setProgress(progRes.value);
    if (vehRes.status === 'fulfilled') setVehicles(Array.isArray(vehRes.value) ? vehRes.value : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1D1D1F] border-t-transparent" /></div>;

  const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const statusColor: Record<string, string> = {
    active: 'text-emerald-600 bg-emerald-50', pending_review: 'text-amber-600 bg-amber-50',
    draft: 'text-[#86868B] bg-[#F5F5F7]', rejected: 'text-red-600 bg-red-50',
    suspended: 'text-red-600 bg-red-50', pending_documents: 'text-blue-600 bg-blue-50',
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-[#F5F5F7]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] text-[#1D1D1F]">
            <span className="font-semibold">TakeMe</span><span className="ml-1 font-light text-[#8E8E93]">Fleet</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/fleet/payouts" className="text-[14px] font-medium text-[#86868B] hover:text-[#1D1D1F]">Payouts</Link>
            <Link href="/fleet/vehicles/new" className="rounded-[999px] bg-[#1D1D1F] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#333]">Add vehicle</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-[1200px] px-6 py-10 lg:px-10">
        {/* Onboarding progress */}
        {progress && progress.missingItems.length > 0 && (
          <div className="mb-8 rounded-xl border border-[#E8E8ED] bg-[#FAFAFA] p-6">
            <p className="text-[15px] font-semibold text-[#1D1D1F]">Complete onboarding</p>
            <div className="mt-3 space-y-2">
              {progress.missingItems.map(item => (
                <div key={item} className="flex items-center gap-2 text-[14px] text-[#6E6E73]">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        <h1 className="text-[24px] font-semibold text-[#1D1D1F]">Your vehicles</h1>

        {vehicles.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-[15px] text-[#86868B]">No vehicles yet.</p>
            <Link href="/fleet/vehicles/new" className="mt-4 inline-flex rounded-[999px] bg-[#1D1D1F] px-6 py-2.5 text-[15px] font-medium text-white hover:bg-[#333]">Add your first vehicle</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vehicles.map(v => (
              <Link key={v.id} href={`/fleet/vehicles/${v.id}`} className="group rounded-2xl border border-[#E8E8ED] bg-white p-5 transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between">
                  <span className="text-[16px] font-semibold text-[#1D1D1F]">{v.year} {v.make} {v.model}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusColor[v.status] ?? 'text-[#86868B] bg-[#F5F5F7]'}`}>
                    {v.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-[#86868B]">{usd(v.daily_rate_cents)}/day</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
