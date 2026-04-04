'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Watermark from '@/components/security/Watermark';

export default function ExecLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.email) setUser({ email: d.email, role: d.role }); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#111111]">
      {user && <Watermark userEmail={user.email} role={user.role} />}
      <nav className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/exec/dashboard" className="text-[15px] font-semibold text-[#111111]">
              TakeMe <span className="font-light text-[#9CA3AF]">Executive</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-[13px] text-[#9CA3AF] hover:text-[#111111] transition-colors">
              Admin &rarr;
            </Link>
            {user && (
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[12px] font-medium text-emerald-400">
                {user.role}
              </span>
            )}
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
