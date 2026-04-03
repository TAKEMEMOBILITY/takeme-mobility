'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ConnectCard({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [activating, setActivating] = useState(false);

  const handleActivate = useCallback(async () => {
    setActivating(true);
    try {
      const res = await fetch('/api/connect/subscribe', { method: 'POST' });
      const data = await res.json() as { checkoutUrl?: string; activated?: boolean; error?: string };
      if (!res.ok) {
        if (res.status === 401) { router.push('/auth/login?redirect=/driver/connect'); return; }
        alert(data.error || 'Subscription failed');
        return;
      }
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      if (data.activated) { router.push('/driver/connect/success'); }
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setActivating(false);
    }
  }, [router]);
  if (compact) {
    return (
      <Link href="/driver/connect" className="flex items-center gap-4 rounded-2xl border border-[#E5E5EA] bg-white p-4 transition-all duration-200 hover:border-[#C7C7CC] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0A0A0A]">
          <svg className="h-5 w-5 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#D42B2B]">TAKEME CONNECT</p>
          <p className="text-[12px] text-[#86868B]">Unlimited data & calls · $29.90/mo</p>
        </div>
        <svg className="h-4 w-4 shrink-0 text-[#C7C7CC]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0A0A0A]">
      {/* Header */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <svg className="h-5 w-5 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">Driver Essential</p>
            <p className="mt-0.5 text-[17px] font-semibold text-white">TAKEME CONNECT</p>
          </div>
        </div>

        <p className="mt-4 text-[14px] leading-relaxed text-white/50">
          Stay online every ride. No dropped trips. No missed income.
        </p>

        {/* Price */}
        <p className="mt-5 text-[12px] text-white/30">Drivers lose $50+ from a single dropped ride.</p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-[32px] font-bold tabular-nums text-white">$29.90</span>
          <span className="text-[14px] font-medium text-white/40">/month</span>
        </div>
        <p className="mt-1.5 text-[13px] text-white/35">Less than $1/day.</p>
      </div>

      {/* Features */}
      <div className="border-t border-white/10 px-6 py-5">
        <div className="space-y-3">
          {[
            'Stay online every ride',
            'No dropped trips',
            'Works with all driver apps',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <svg className="h-4 w-4 shrink-0 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span className="text-[14px] font-medium text-white/70">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Loss prevention */}
      <div className="px-6">
        <p className="text-[13px] text-white/45">One missed ride can cost $20–$50.</p>
      </div>

      {/* CTA */}
      <div className="px-6 pt-4 pb-6">
        <button
          onClick={handleActivate}
          disabled={activating}
          className="flex w-full items-center justify-center rounded-xl bg-white py-3.5 text-[15px] font-semibold text-[#D42B2B] transition-colors duration-200 hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
        >
          {activating ? 'Activating...' : 'Protect your earnings'}
        </button>
      </div>
    </div>
  );
}
