'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FleetApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.fullName || !form.email) { setError('Name and email are required.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/fleet/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push('/fleet/vehicles');
      } else {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong.');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-[#F5F5F7]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] text-[#1D1D1F]">
            <span className="font-semibold">TakeMe</span><span className="ml-1 font-light text-[#8E8E93]">Fleet</span>
          </Link>
          <Link href="/auth/login" className="text-[14px] font-medium text-[#86868B] hover:text-[#1D1D1F]">Sign in</Link>
        </div>
      </nav>

      <div className="mx-auto max-w-lg px-6 py-20">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#1D6AE5]">Fleet Partner Program</p>
        <h1 className="mt-4 text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F]">
          List your EV. Earn passive income.
        </h1>
        <p className="mt-4 text-[17px] leading-[1.6] text-[#86868B]">
          Join the TakeMe fleet network. We handle driver matching, payments, and platform trust. You earn 80% of every rental.
        </p>

        <div className="mt-10 space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[#1D1D1F]">Full name</label>
            <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#E8E8ED] bg-[#FAFAFA] px-4 py-3 text-[15px] text-[#1D1D1F] outline-none focus:border-[#1D6AE5] focus:bg-white" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#1D1D1F]">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#E8E8ED] bg-[#FAFAFA] px-4 py-3 text-[15px] text-[#1D1D1F] outline-none focus:border-[#1D6AE5] focus:bg-white" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#1D1D1F]">Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#E8E8ED] bg-[#FAFAFA] px-4 py-3 text-[15px] text-[#1D1D1F] outline-none focus:border-[#1D6AE5] focus:bg-white" />
          </div>
          {error && <p className="text-[14px] text-[#FF3B30]">{error}</p>}
          <button onClick={handleSubmit} disabled={loading} className="mt-4 flex w-full items-center justify-center rounded-[999px] bg-[#1D1D1F] py-3.5 text-[16px] font-medium text-white transition-colors hover:bg-[#333] disabled:opacity-50">
            {loading ? 'Creating account...' : 'Start onboarding'}
          </button>
        </div>

        <div className="mt-8 rounded-xl bg-[#F5F5F7] p-5">
          <p className="text-[13px] font-semibold text-[#1D1D1F]">What to expect</p>
          <div className="mt-3 space-y-2 text-[14px] text-[#6E6E73]">
            <p>1. Complete your profile and identity verification</p>
            <p>2. Upload vehicle documents and photos</p>
            <p>3. Sign the fleet partner agreement</p>
            <p>4. Admin review and vehicle activation</p>
            <p>5. Start earning from day one</p>
          </div>
        </div>
      </div>
    </div>
  );
}
