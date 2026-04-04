'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

const VEHICLE_CLASSES = [
  { id: 'electric', label: 'Electric', desc: 'Standard EV' },
  { id: 'comfort_electric', label: 'Comfort Electric', desc: 'Spacious EV' },
  { id: 'premium_electric', label: 'Premium Electric', desc: 'Luxury EV' },
  { id: 'suv_electric', label: 'SUV Electric', desc: 'Large EV' },
];

const REQUIRED_DOCS = [
  { key: 'license', label: "Driver's License", accept: 'image/*,.pdf' },
  { key: 'registration', label: 'Vehicle Registration', accept: 'image/*,.pdf' },
  { key: 'insurance', label: 'Insurance Card', accept: 'image/*,.pdf' },
];

// Earnings estimates (per hour, by vehicle class)
const HOURLY_RATES: Record<string, number> = {
  electric: 22, comfort_electric: 28, premium_electric: 38, suv_electric: 42,
};

type AppStatus = 'hero' | 'form' | 'submitting' | 'submitted' | 'already_applied';

export default function DriverApplyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<AppStatus>('hero');
  const [error, setError] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleClass, setVehicleClass] = useState('electric');

  // Document uploads
  const [docs, setDocs] = useState<Record<string, File | null>>({ license: null, registration: null, insurance: null });

  // Background check consent
  const [bgCheckConsent, setBgCheckConsent] = useState(false);

  // Earnings calculator
  const [hoursPerWeek, setHoursPerWeek] = useState(30);
  const weeklyEarnings = useMemo(() => {
    const rate = HOURLY_RATES[vehicleClass] ?? HOURLY_RATES.electric;
    return Math.round(hoursPerWeek * rate);
  }, [hoursPerWeek, vehicleClass]);

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

  const handleDocChange = (key: string, file: File | null) => {
    setDocs(prev => ({ ...prev, [key]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push('/auth/login?redirect=/driver/apply'); return; }
    if (!bgCheckConsent) { setError('Please consent to the background check to continue.'); return; }

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
          backgroundCheckConsent: true,
          documentsUploaded: Object.entries(docs).filter(([, f]) => f !== null).map(([k]) => k),
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
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d2d2d7] border-t-[#1d1d1f]" />
      </div>
    );
  }

  // Already applied
  if (status === 'already_applied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0071e3]/10">
            <svg className="h-6 w-6 text-[#0071e3]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="mt-5 text-[22px] font-semibold text-[#1d1d1f]">Application under review</h1>
          <p className="mt-2 text-[15px] text-[#6e6e73]">We&apos;ll notify you once your application is approved.</p>
          <Link href="/" className="mt-6 inline-flex items-center text-[14px] font-medium text-[#0071e3] hover:opacity-70">&larr; Back to home</Link>
        </div>
      </div>
    );
  }

  // Submitted success
  if (status === 'submitted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0071e3]/10">
            <svg className="h-7 w-7 text-[#0071e3]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="mt-5 text-[22px] font-semibold text-[#1d1d1f]">Application submitted</h1>
          <p className="mt-2 text-[15px] text-[#6e6e73]">We&apos;ll review your application and get back to you within 24-48 hours.</p>
          <Link href="/" className="mt-6 inline-flex items-center text-[14px] font-medium text-[#0071e3] hover:opacity-70">&larr; Back to home</Link>
        </div>
      </div>
    );
  }

  // ── HERO SECTION ─────────────────────────────────────────────────────────
  if (status === 'hero') {
    return (
      <div className="min-h-screen bg-white">
        {/* Nav */}
        <header className="border-b border-[#f5f5f7] px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <Link href="/" className="text-[15px]">
              <span className="font-semibold text-[#1d1d1f]">TakeMe</span>
              <span className="ml-1 font-light text-[#6e6e73]">Driver</span>
            </Link>
            {user ? (
              <button onClick={() => setStatus('form')} className="rounded-full bg-[#0071e3] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#005bb5]">
                Apply now
              </button>
            ) : (
              <Link href="/auth/login?redirect=/driver/apply" className="rounded-full bg-[#0071e3] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#005bb5]">
                Sign in to apply
              </Link>
            )}
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#0071e3]">Now accepting drivers</p>
              <h1 className="mt-3 text-[36px] font-bold leading-[1.1] tracking-tight text-[#1d1d1f] md:text-[48px]">
                Drive electric.<br />Earn more.
              </h1>
              <p className="mt-4 text-[17px] leading-relaxed text-[#6e6e73]">
                Join Seattle&apos;s premium all-electric ride platform. Flexible hours, instant payouts, and a free TAKEME Card with cashback on EV charging.
              </p>

              {/* Requirements */}
              <div className="mt-8 space-y-3">
                {[
                  'Valid driver\'s license (2+ years)',
                  'Electric or hybrid vehicle (2018+)',
                  'Clean driving record',
                  'Pass background check',
                  'Valid insurance and registration',
                ].map(req => (
                  <div key={req} className="flex items-center gap-3">
                    <svg className="h-4 w-4 shrink-0 text-[#0071e3]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span className="text-[14px] text-[#1d1d1f]">{req}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => user ? setStatus('form') : router.push('/auth/login?redirect=/driver/apply')}
                className="mt-8 rounded-2xl bg-[#0071e3] px-8 py-4 text-[16px] font-semibold text-white transition-colors hover:bg-[#005bb5]"
              >
                Start your application
              </button>
            </div>

            {/* Earnings Calculator */}
            <div className="rounded-3xl bg-gradient-to-br from-[#f5f5f7] to-[#f5f5f7] p-8">
              <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-[#6e6e73]">Earnings estimate</p>
              <div className="mt-4">
                <label className="text-[13px] font-medium text-[#1d1d1f]">Hours per week</label>
                <input
                  type="range"
                  min={5} max={60} value={hoursPerWeek}
                  onChange={e => setHoursPerWeek(parseInt(e.target.value))}
                  className="mt-2 w-full accent-[#0071e3]"
                />
                <div className="mt-1 flex justify-between text-[12px] text-[#86868b]">
                  <span>5 hrs</span>
                  <span className="font-semibold text-[#1d1d1f]">{hoursPerWeek} hrs/week</span>
                  <span>60 hrs</span>
                </div>
              </div>

              <div className="mt-6">
                <label className="text-[13px] font-medium text-[#1d1d1f]">Vehicle class</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {VEHICLE_CLASSES.map(vc => (
                    <button
                      key={vc.id}
                      onClick={() => setVehicleClass(vc.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                        vehicleClass === vc.id
                          ? 'border-[#0071e3] bg-[#0071e3] text-white'
                          : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'
                      }`}
                    >
                      <p className={`text-[12px] font-semibold ${vehicleClass === vc.id ? 'text-white' : 'text-[#1d1d1f]'}`}>{vc.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-[13px] text-[#6e6e73]">Estimated weekly earnings</p>
                <p className="mt-1 text-[48px] font-bold tracking-tight text-[#1d1d1f]">${weeklyEarnings.toLocaleString()}</p>
                <p className="text-[13px] text-[#86868b]">${(weeklyEarnings * 52).toLocaleString()}/year &middot; ${HOURLY_RATES[vehicleClass]}/hr avg</p>
              </div>

              <p className="mt-4 text-center text-[11px] text-[#86868b]">
                Estimates based on Seattle market data. Actual earnings vary by demand, location, and hours.
              </p>
            </div>
          </div>
        </section>

        {/* Perks */}
        <section className="border-t border-[#f5f5f7] bg-[#f5f5f7] px-6 py-16">
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              { icon: '\u26A1', title: 'Instant Payouts', desc: 'Cash out anytime to your TAKEME Card or bank account. No waiting.' },
              { icon: '\uD83D\uDCB3', title: 'TAKEME Card', desc: 'Free debit card with 5% cashback on EV charging, 3% on gas, 1% everything else.' },
              { icon: '\uD83D\uDCC8', title: 'Surge Earnings', desc: 'Earn up to 3x during high demand periods. Smart matching gives you the best trips.' },
            ].map(perk => (
              <div key={perk.title} className="text-center">
                <span className="text-[32px]">{perk.icon}</span>
                <h3 className="mt-3 text-[16px] font-semibold text-[#1d1d1f]">{perk.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">{perk.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ── APPLICATION FORM ─────────────────────────────────────────────────────
  const inputCls = "w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] font-medium text-[#1d1d1f] placeholder-[#86868b] outline-none focus:border-[#0071e3] transition-colors";

  const allDocsUploaded = REQUIRED_DOCS.every(d => docs[d.key] !== null);
  const formValid = fullName && phone && licenseNumber && vehicleMake && vehicleModel && plateNumber && bgCheckConsent;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#f5f5f7] px-6 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <button onClick={() => setStatus('hero')} className="text-[15px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">&larr; Back</button>
          <p className="text-[15px] font-semibold text-[#1d1d1f]">Driver Application</p>
          <div className="w-12" />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 py-8">
        <h1 className="text-[24px] font-semibold text-[#1d1d1f]">Drive with TakeMe</h1>
        <p className="mt-2 text-[15px] text-[#6e6e73]">Join Seattle&apos;s all-electric ride platform.</p>

        {!user && (
          <div className="mt-4 rounded-xl bg-[#FFF8E1] px-4 py-3">
            <p className="text-[13px] text-[#1d1d1f]">
              <Link href="/auth/login?redirect=/driver/apply" className="font-semibold text-[#0071e3] hover:underline">Sign in</Link> to save your progress and submit.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-[#FF3B30]/8 px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
            <p className="text-[13px] font-medium text-[#1d1d1f]">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Personal */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Personal info</p>
            <div className="space-y-2">
              <input value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Full legal name" className={inputCls} />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="Phone number" className={inputCls} />
              <input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} required placeholder="Driver's license number" className={inputCls} />
            </div>
          </div>

          {/* Vehicle */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Vehicle info</p>
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
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Vehicle class</p>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLE_CLASSES.map(vc => (
                <button
                  key={vc.id}
                  type="button"
                  onClick={() => setVehicleClass(vc.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    vehicleClass === vc.id
                      ? 'border-[#0071e3] bg-[#0071e3] text-white'
                      : 'border-[#d2d2d7] hover:border-[#86868b]'
                  }`}
                >
                  <p className={`text-[13px] font-semibold ${vehicleClass === vc.id ? 'text-white' : 'text-[#1d1d1f]'}`}>{vc.label}</p>
                  <p className={`text-[11px] ${vehicleClass === vc.id ? 'text-white/60' : 'text-[#6e6e73]'}`}>{vc.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Document uploads */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Documents</p>
            <p className="mb-3 text-[13px] text-[#6e6e73]">Upload photos or PDFs of the following documents.</p>
            <div className="space-y-2">
              {REQUIRED_DOCS.map(doc => (
                <label
                  key={doc.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                    docs[doc.key] ? 'border-[#0071e3] bg-[#0071e3]/5' : 'border-dashed border-[#d2d2d7] hover:border-[#86868b]'
                  }`}
                >
                  {docs[doc.key] ? (
                    <svg className="h-5 w-5 shrink-0 text-[#0071e3]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 shrink-0 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-[#1d1d1f]">{doc.label}</p>
                    <p className="text-[12px] text-[#86868b]">
                      {docs[doc.key] ? docs[doc.key]!.name : 'Tap to upload'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept={doc.accept}
                    className="hidden"
                    onChange={e => handleDocChange(doc.key, e.target.files?.[0] ?? null)}
                  />
                </label>
              ))}
            </div>
            {!allDocsUploaded && (
              <p className="mt-2 text-[12px] text-[#86868b]">Documents can also be uploaded later from your driver profile.</p>
            )}
          </div>

          {/* Background check consent */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Background check</p>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d2d2d7] px-4 py-4">
              <input
                type="checkbox"
                checked={bgCheckConsent}
                onChange={e => setBgCheckConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0071e3]"
              />
              <div>
                <p className="text-[14px] font-medium text-[#1d1d1f]">I consent to a background check</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
                  By checking this box, I authorize TakeMe Mobility to conduct a background check as part of the driver onboarding process. This includes a review of my driving record, criminal history, and identity verification.
                </p>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={status === 'submitting' || !formValid}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-[#0071e3] py-4 text-[16px] font-semibold text-white transition-colors hover:bg-[#005bb5] disabled:opacity-40"
          >
            {status === 'submitting' ? 'Submitting...' : 'Submit application'}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] text-[#86868b]">
          By applying, you agree to our driver terms and background check policy.
        </p>

        {/* TAKEME Card promo */}
        <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d1d1f] to-[#2C2C2E] p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="h-4 w-4 rounded-full bg-[#FF3B30] opacity-80" />
              <div className="-ml-1.5 h-4 w-4 rounded-full bg-[#FF9500] opacity-80" />
            </div>
            <span className="text-[14px] font-semibold text-white">TAKEME Card</span>
            <span className="rounded-full bg-[#0071e3] px-1.5 py-[1px] text-[9px] font-bold uppercase text-white">Free</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-white/50">
            Get instant payouts, cashback on EV charging, and exclusive driver rewards — all in one card.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {['Instant payouts', 'Cashback rewards', 'No fees'].map(b => (
              <span key={b} className="flex items-center gap-1.5 text-[11px] font-medium text-white/60">
                <svg className="h-3 w-3 text-[#0071e3]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
