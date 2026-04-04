'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const bookingId = params.get('id');

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1D6AE5]/10">
          <svg className="h-8 w-8 text-[#1D6AE5]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>

        <h1 className="mt-6 text-[24px] font-semibold text-[#1d1d1f]">Ride confirmed</h1>
        <p className="mt-2 text-[15px] text-[#6e6e73]">
          Your payment was successful. Your driver is being assigned.
        </p>

        {bookingId && (
          <p className="mt-4 rounded-xl bg-[#f5f5f7] px-4 py-3 text-[13px] font-mono text-[#6e6e73]">
            Booking: {bookingId.slice(0, 8)}...
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center rounded-xl bg-[#1D6AE5] py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-[#005bb5]"
          >
            Track your ride
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center rounded-xl border border-[#d2d2d7] py-3.5 text-[15px] font-medium text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d2d2d7] border-t-[#1D6AE5]" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
