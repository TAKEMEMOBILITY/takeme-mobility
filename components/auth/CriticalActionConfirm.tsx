'use client';

import { useState, useCallback, type ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// CriticalActionConfirm — Re-authentication gate for dangerous operations
//
// Requires MFA code or password before executing critical actions.
// 5-minute window after confirmation before requiring again.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  action: string;           // e.g. "Delete Driver"
  description: string;      // e.g. "This will permanently remove driver John Doe"
  resourceId?: string;
  onConfirm: () => Promise<void>;
  children: (trigger: () => void) => ReactNode;
}

let lastConfirmTime = 0;
const CONFIRM_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export default function CriticalActionConfirm({ action, description, onConfirm, children }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trigger = useCallback(() => {
    // Skip re-auth if confirmed within the last 5 minutes
    if (Date.now() - lastConfirmTime < CONFIRM_WINDOW_MS) {
      onConfirm();
      return;
    }
    setOpen(true);
    setCode('');
    setError('');
  }, [onConfirm]);

  const handleConfirm = async () => {
    if (code.length < 4) {
      setError('Please enter your verification code');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Verify MFA code via API
      const res = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action }),
      });

      if (!res.ok) {
        setError('Invalid code. Please try again.');
        setLoading(false);
        return;
      }

      lastConfirmTime = Date.now();
      setOpen(false);
      await onConfirm();
    } catch {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {children(trigger)}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#1e1e2e] bg-[#0f0f17] p-6 text-[#e4e4e7] shadow-2xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>

            <h3 className="mt-4 text-[16px] font-semibold text-white">{action}</h3>
            <p className="mt-2 text-[14px] text-[#71717a]">{description}</p>

            <div className="mt-6">
              <label className="text-[12px] font-medium text-[#71717a]">Enter MFA code to confirm</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="mt-2 w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-4 py-2.5 text-center text-[18px] font-bold tracking-[0.3em] text-white placeholder-[#3f3f46] outline-none focus:border-[#3f3f46]"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              />
              {error && <p className="mt-2 text-[13px] text-red-400">{error}</p>}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-[#1e1e2e] py-2.5 text-[14px] font-medium text-[#71717a] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 rounded-lg bg-red-500/20 py-2.5 text-[14px] font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
