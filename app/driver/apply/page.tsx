'use client';

import Link from 'next/link';
import ConnectCard from '@/components/ConnectCard';

export default function DriverApplyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F5F7]">
            <svg className="h-7 w-7 text-[#1D1D1F]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="mt-6 text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Drive with TakeMe</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-[#86868B]">
            Join Seattle&apos;s all-electric ride platform. Set your own schedule, drive premium vehicles, earn more.
          </p>
          <div className="mt-8 space-y-3">
            <Link
              href="/auth/login?redirect=/driver"
              className="flex w-full items-center justify-center rounded-2xl bg-[#1D1D1F] py-4 text-[16px] font-semibold text-white transition-colors hover:bg-[#333]"
            >
              Apply now
            </Link>
            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-2xl border border-[#E5E5EA] py-4 text-[16px] font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
            >
              Back to home
            </Link>
          </div>
        </div>

        {/* TAKEME CONNECT upsell */}
        <div className="mt-10">
          <p className="mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">Optional add-on</p>
          <ConnectCard />
        </div>
      </div>
    </div>
  );
}
