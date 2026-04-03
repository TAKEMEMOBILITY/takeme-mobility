'use client';

import Link from 'next/link';

// Looks identical to a genuine 404 — never reveals "unauthorized" or "forbidden"
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-[#e4e4e7]">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="mt-4 text-lg text-[#71717a]">This page could not be found.</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-[#1e1e2e] px-6 py-2.5 text-[14px] font-medium text-[#a1a1aa] transition-colors hover:text-white"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
