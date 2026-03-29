'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

const VEHICLE_CLASSES = [
  { id: 'electric', label: 'Electric', desc: 'Standard EV' },
  { id: 'comfort_electric', label: 'Comfort Electric', desc: 'Spacious EV' },
  { id: 'premium_electric', label: 'Premium Electric', desc: 'Luxury EV' },
  { id: 'suv_electric', label: 'SUV Electric', desc: 'Large EV' },
];

type AppStatus = 'form' | 'submitting' | 'submitted' | 'already_applied';

export default function DriverApplyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<AppStatus>('form');
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleClass, setVehicleClass] = useState('electric');

  // Check existing application
  useEffect(() => {
    if (!user) return;
    fetch('/api/driver/apply')
      .then(r => r.json())
      .then(data => {
        if (data.application?.status === 'pending') setStatus('already_applied');
        if (data.application?.status === 'approved') router.push('/driver');
      })
      .catch(() => {});
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push('/auth/login?redirect=/driver/apply'); return; }

    setStatus('submitting');
    setError('');

    try {
      const res = await fetch('/api/driver/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, phone, licenseNumber,
          vehicleMake, vehicleModel,
          vehicleYear: vehicleYear ? parseInt(vehicleYear) : undefined,
          vehicleColor: vehicleColor || undefined,
          plateNumber, vehicleClass,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Application failed');
      setStatus('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('form');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8E8ED] border-t-[#1D1D1F]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-[24px] font-semibold text-[#1D1D1F]">Drive with TakeMe</h1>
          <p className="mt-3 text-[15px] text-[#86868B]">Sign in to start your driver application.</p>
          <Link href="/auth/login?redirect=/driver/apply" className="mt-6 flex w-full items-center justify-center rounded-2xl bg-[#1D1D1F] py-4 text-[16px] font-semibold text-white hover:bg-[#333]">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // Already applied
  if (status === 'already_applied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0071E3]/10">
            <svg className="h-6 w-6 text-[#0071E3]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="mt-5 text-[22px] font-semibold text-[#1D1D1F]">Application under review</h1>
          <p className="mt-2 text-[15px] text-[#86868B]">We'll notify you once your application is approved.</p>
          <Link href="/" className="mt-6 inline-flex items-center text-[14px] font-medium text-[#0071E3] hover:opacity-70">← Back to home</Link>
        </div>
      </div>
    );
  }

  // Submitted success
  if (status === 'submitted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#34C759]/10">
            <svg className="h-7 w-7 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="mt-5 text-[22px] font-semibold text-[#1D1D1F]">Application submitted</h1>
          <p className="mt-2 text-[15px] text-[#86868B]">We'll review your application and get back to you within 24-48 hours.</p>
          <Link href="/" className="mt-6 inline-flex items-center text-[14px] font-medium text-[#0071E3] hover:opacity-70">← Back to home</Link>
        </div>
      </div>
    );
  }

  // Application form
  const inputCls = "w-full rounded-xl border border-[#E5E5EA] bg-white px-4 py-3 text-[15px] font-medium text-[#1D1D1F] placeholder-[#C7C7CC] outline-none focus:border-[#1D1D1F] transition-colors";

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#F5F5F7] px-6 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/" className="text-[15px] font-medium text-[#86868B] hover:text-[#1D1D1F]">← Back</Link>
          <p className="text-[15px] font-semibold text-[#1D1D1F]">Driver Application</p>
          <div className="w-12" />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 py-8">
        <h1 className="text-[24px] font-semibold text-[#1D1D1F]">Drive with TakeMe</h1>
        <p className="mt-2 text-[15px] text-[#86868B]">Join Seattle's all-electric ride platform.</p>

        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-[#FF3B30]/8 px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
            <p className="text-[13px] font-medium text-[#1D1D1F]">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Personal */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">Personal info</p>
            <div className="space-y-2">
              <input value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Full legal name" className={inputCls} />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="Phone number" className={inputCls} />
              <input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} required placeholder="Driver's license number" className={inputCls} />
            </div>
          </div>

          {/* Vehicle */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">Vehicle info</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={vehicleMake} onChange={e => setVehicleMake(e.target.value)} required placeholder="Make (e.g. Tesla)" className={inputCls} />
                <input value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} required placeholder="Model (e.g. Model 3)" className={inputCls} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={vehicleYear} onChange={e => setVehicleYear(e.target.value)} placeholder="Year" min={2015} max={2030} className={inputCls} />
                <input value={vehicleColor} onChange={e => setVehicleColor(e.target.value)} placeholder="Color" className={inputCls} />
                <input value={plateNumber} onChange={e => setPlateNumber(e.target.value.toUpperCase())} required placeholder="Plate #" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Vehicle class */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">Vehicle class</p>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLE_CLASSES.map(vc => (
                <button
                  key={vc.id}
                  type="button"
                  onClick={() => setVehicleClass(vc.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    vehicleClass === vc.id
                      ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white'
                      : 'border-[#E5E5EA] hover:border-[#C7C7CC]'
                  }`}
                >
                  <p className={`text-[13px] font-semibold ${vehicleClass === vc.id ? 'text-white' : 'text-[#1D1D1F]'}`}>{vc.label}</p>
                  <p className={`text-[11px] ${vehicleClass === vc.id ? 'text-white/60' : 'text-[#86868B]'}`}>{vc.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-[#1D1D1F] py-4 text-[16px] font-semibold text-white transition-colors hover:bg-[#333] disabled:opacity-50"
          >
            {status === 'submitting' ? 'Submitting...' : 'Submit application'}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] text-[#A1A1A6]">
          By applying, you agree to our driver terms and background check policy.
        </p>
      </div>
    </div>
  );
}
