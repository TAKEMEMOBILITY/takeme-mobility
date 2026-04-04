'use client';

import Link from 'next/link';

export default function ConnectSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0071e3]/10">
          <svg className="h-8 w-8 text-[#0071e3]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="mt-6 text-[24px] font-semibold text-[#1d1d1f]">You're connected</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">
          TAKEME CONNECT is now active. Unlimited data and calls are ready to go.
        </p>
        <div className="mt-8 space-y-3">
          <Link href="/driver" className="flex w-full items-center justify-center rounded-2xl bg-[#0071e3] py-4 text-[16px] font-semibold text-white hover:bg-[#005bb5]">
            Go to Driver Hub
          </Link>
          <Link href="/" className="flex w-full items-center justify-center rounded-2xl border border-[#d2d2d7] py-4 text-[16px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
