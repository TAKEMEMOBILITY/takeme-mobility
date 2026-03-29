'use client';

import Link from 'next/link';
import ConnectCard from '@/components/ConnectCard';

export default function ConnectPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-[#F5F5F7] px-6 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/driver" className="text-[15px] font-medium text-[#86868B] hover:text-[#1D1D1F]">
            ← Back
          </Link>
          <p className="text-[15px] font-semibold text-[#1D1D1F]">TAKEME CONNECT</p>
          <div className="w-12" />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 py-10">
        <ConnectCard />

        <div className="mt-8 space-y-4">
          <div className="rounded-xl bg-[#F5F5F7] p-5">
            <p className="text-[13px] font-semibold text-[#1D1D1F]">How it works</p>
            <div className="mt-3 space-y-2.5">
              {[
                'Activate your plan instantly',
                'Receive your eSIM or physical SIM',
                'Unlimited data & calls from day one',
                'Cancel anytime — no contract',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-[10px] font-bold text-white">{i + 1}</span>
                  <p className="text-[14px] text-[#86868B]">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-[12px] text-[#A1A1A6]">
            Plan is billed monthly. Cancel anytime from your driver dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
