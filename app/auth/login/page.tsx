'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Suspense } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Phone OTP Auth — unified sign-in / sign-up
// Enter phone → receive code → verify → signed in
// ═══════════════════════════════════════════════════════════════════════════

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

type LoginMethod = 'phone' | 'email';

function PhoneAuth() {
  const { user, sendOtp, verifyOtp, sendEmailOtp, verifyEmailOtp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const [method, setMethod] = useState<LoginMethod>('phone');
  const [step, setStep] = useState<'input' | 'code' | 'success'>('input');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // If already signed in, redirect
  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, router, redirect]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Auto-focus code input
  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  const handleSendCode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (method === 'phone') {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Enter a valid 10-digit phone number.');
        setLoading(false);
        return;
      }
      const { error: err } = await sendOtp(toE164(phone));
      setLoading(false);
      if (err) { setError(err); return; }
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Enter a valid email address.');
        setLoading(false);
        return;
      }
      const { error: err } = await sendEmailOtp(email.trim());
      setLoading(false);
      if (err) { setError(err); return; }
    }

    setStep('code');
    setCooldown(60);
  }, [method, phone, email, sendOtp, sendEmailOtp]);

  const handleVerifyCode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');
    const { error: err } = method === 'phone'
      ? await verifyOtp(toE164(phone), code)
      : await verifyEmailOtp(email.trim(), code);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setStep('success');
      setTimeout(() => router.replace(redirect), 1500);
    }
  }, [code, method, phone, email, verifyOtp, verifyEmailOtp, router, redirect]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError('');
    const { error: err } = method === 'phone'
      ? await sendOtp(toE164(phone))
      : await sendEmailOtp(email.trim());
    setLoading(false);
    if (err) setError(err);
    else setCooldown(60);
  }, [cooldown, method, phone, email, sendOtp, sendEmailOtp]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-10 text-center">
          <Link href="/" className="text-[22px] tracking-[0.01em] text-[#1D1D1F]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#8E8E93]">Mobility</span>
          </Link>
          <p className="mt-3 text-[15px] text-[#86868B]">
            {step === 'input'
              ? (method === 'phone' ? 'Enter your phone number to continue' : 'Enter your email to continue')
              : step === 'code' ? 'Enter the code we sent you'
              : 'You\'re signed in'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-[#FFF5F5] px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
            <p className="text-[13px] text-[#1D1D1F]">{error}</p>
          </div>
        )}

        {/* ── Input step ────────────────────────────────────── */}
        {step === 'input' && (
          <form onSubmit={handleSendCode}>
            {/* Phone / Email toggle */}
            <div className="mb-4 flex rounded-xl bg-[#F5F5F7] p-1">
              <button
                type="button"
                onClick={() => { setMethod('phone'); setError(''); }}
                className={`flex-1 rounded-[10px] py-2 text-[13px] font-medium transition-all ${method === 'phone' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B]'}`}
              >
                Phone
              </button>
              <button
                type="button"
                onClick={() => { setMethod('email'); setError(''); }}
                className={`flex-1 rounded-[10px] py-2 text-[13px] font-medium transition-all ${method === 'email' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B]'}`}
              >
                Email
              </button>
            </div>

            {method === 'phone' ? (
              <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
                <span className="text-[15px] font-medium text-[#86868B]">+1</span>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  maxLength={14}
                  autoFocus
                  className="w-full bg-transparent text-[17px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
                />
              </div>
            ) : (
              <div className="flex items-center rounded-xl bg-[#F5F5F7] px-4 py-3.5">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  autoFocus
                  className="w-full bg-transparent text-[17px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (method === 'phone' ? phone.replace(/\D/g, '').length < 10 : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#1D1D1F] py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245] disabled:opacity-40"
            >
              {loading ? 'Sending code...' : 'Send verification code'}
            </button>
          </form>
        )}

        {/* ── Code step ─────────────────────────────────────── */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode}>
            <p className="mb-3 text-center text-[13px] text-[#86868B]">
              Sent to <span className="font-semibold text-[#1D1D1F]">{method === 'phone' ? `+1 ${phone}` : email}</span>
            </p>

            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="w-full rounded-xl bg-[#F5F5F7] px-4 py-4 text-center text-[24px] font-bold tracking-[0.3em] text-[#1D1D1F] placeholder-[#D2D2D7] outline-none"
            />

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#1D1D1F] py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245] disabled:opacity-40"
            >
              {loading ? 'Verifying...' : 'Verify & continue'}
            </button>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setStep('input'); setCode(''); setError(''); }}
                className="text-[13px] text-[#86868B] hover:text-[#1D1D1F]"
              >
                {method === 'phone' ? 'Change number' : 'Change email'}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                className="text-[13px] text-[#0071E3] hover:opacity-70 disabled:text-[#A1A1A6]"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {/* ── Success step ─────────────────────────────────── */}
        {step === 'success' && (
          <div className="flex flex-col items-center py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#34C759]/10">
              <svg className="h-7 w-7 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <p className="mt-4 text-[16px] font-semibold text-[#1D1D1F]">Signed in</p>
            <p className="mt-1 text-[13px] text-[#86868B]">Redirecting you back...</p>
          </div>
        )}

        <p className="mt-10 text-center text-[12px] text-[#A1A1A6]">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8E8ED] border-t-[#1D1D1F]" />
      </div>
    }>
      <PhoneAuth />
    </Suspense>
  );
}
