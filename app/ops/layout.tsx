'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Watermark from '@/components/security/Watermark';
import CopyProtect from '@/components/security/CopyProtect';

// ═══════════════════════════════════════════════════════════════════════════
// /ops layout — Injects watermark + copy protection on all /ops/* pages
// ═══════════════════════════════════════════════════════════════════════════

export default function OpsLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string; role: string; sessionId?: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.email) setUser({ email: d.email, role: d.role ?? 'unknown', sessionId: d.sessionId });
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {user && <Watermark userEmail={user.email} role={user.role} sessionId={user.sessionId} />}
      <CopyProtect>
        <style>{`@media print { body { display: none !important; } }`}</style>
        {children}
      </CopyProtect>
    </>
  );
}
