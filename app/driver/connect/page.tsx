'use client';

import Link from 'next/link';
import ConnectCard from '@/components/ConnectCard';

export default function ConnectPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-[#f5f5f7] px-6 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/driver" className="text-[15px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">
            ← Back
          </Link>
          <p className="text-[15px] font-semibold text-[#1d1d1f]">TAKEME CONNECT</p>
          <div className="w-12" />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 py-10">
        <ConnectCard />

        <div className="mt-8 space-y-4">
          <div className="rounded-xl bg-[#f5f5f7] p-5">
            <p className="text-[13px] font-semibold text-[#1d1d1f]">How it works</p>
            <div className="mt-3 space-y-2.5">
              {[
                'Activate your plan instantly',
                'Receive your eSIM or physical SIM',
                'Unlimited data & calls from day one',
                'Cancel anytime — no contract',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-[10px] font-bold text-white">{i + 1}</span>
                  <p className="text-[14px] text-[#6e6e73]">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-[12px] text-[#86868b]">
            Plan is billed monthly. Cancel anytime from your driver dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
