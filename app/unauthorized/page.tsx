'use client';

import Link from 'next/link';

// Looks identical to a genuine 404 — never reveals "unauthorized" or "forbidden"
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] text-[#1d1d1f]">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="mt-4 text-lg text-[#86868b]">This page could not be found.</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-[#0071e3] px-6 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#005bb5]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
