'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';

// ── Hooks ────────────────────────────────────────────────────────────────

function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false);
  const handler = useCallback(() => {
    if (typeof window !== 'undefined') setScrolled(window.scrollY > threshold);
  }, [threshold]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [handler]);
  return scrolled;
}

function useReveal(threshold = 0.18) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ── Data ─────────────────────────────────────────────────────────────────

const FRAUD_CHECKS = [
  {
    name: 'GPS Spoofing',
    description: 'Detects impossible speeds above 200 km/h, teleportation beyond 5 km in under 10 seconds, and synthetic straight-line movement patterns.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
      </svg>
    ),
  },
  {
    name: 'Ghost Ride Detection',
    description: 'Flags trips under 100 m distance or 30 seconds duration. Zero-distance trips with elapsed time trigger instant 90-point scores.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    name: 'Route Deviation',
    description: 'Compares actual distance against estimated. Flags deviations exceeding 40% in either direction as potential manipulation.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
  },
  {
    name: 'Geofence Enforcement',
    description: 'Validates pickup and dropoff coordinates against expected locations. Flags arrivals beyond 500 m of the requested point.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
  },
  {
    name: 'Device Bans',
    description: 'Permanent bans tied to hardware fingerprints. Survives account deletion, phone number changes, and factory resets.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
  },
  {
    name: 'Account Crossmatch',
    description: 'Detects phone numbers, devices, and email addresses reused across multiple accounts to identify duplicate identities.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    name: 'Collusion Analysis',
    description: 'Identifies driver-rider pairs that ride together with unusual frequency. Scales detection sensitivity with repeat count.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    name: 'Score Aggregation',
    description: 'Weighted ensemble of all checks produces a final 0-100 score. Weights are tuned per check based on false-positive rates.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
];

const VERIFICATION_STEPS = [
  {
    step: '01',
    title: 'Identity verification',
    description: 'Government-issued ID validated against a live selfie using facial recognition. Name, photo, and document authenticity confirmed before any account activation.',
  },
  {
    step: '02',
    title: 'Background check',
    description: 'Criminal record screening, driving history review, and sex offender registry check. Conducted through certified third-party providers with continuous re-screening.',
  },
  {
    step: '03',
    title: 'Vehicle inspection',
    description: 'Make, model, year, insurance, and registration verified. TakeMe operates an EV-only fleet, meaning every vehicle meets the highest emission and safety standards.',
  },
  {
    step: '04',
    title: 'Continuous monitoring',
    description: 'Rating thresholds, acceptance rate monitoring, and real-time trip behavior analysis. Drivers are evaluated on every ride, not just at signup.',
  },
];

const MONITORING_FEATURES = [
  {
    title: 'Live location streaming',
    description: 'Sub-200 ms GPS updates via WebSocket. Driver position, heading, and speed tracked continuously from pickup to dropoff.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
      </svg>
    ),
  },
  {
    title: 'Trip sharing',
    description: 'Riders can share their live trip with any contact. Real-time map, ETA, and driver info delivered instantly. No app required for the recipient.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
      </svg>
    ),
  },
  {
    title: 'Anomaly detection',
    description: 'Unexpected stops, route deviations, and speed irregularities trigger automated alerts to the operations team within seconds.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
  },
];

const EMERGENCY_FEATURES = [
  {
    title: 'In-app SOS',
    description: 'One-tap emergency button connects to 911 and shares live location, driver details, and trip info with dispatchers automatically.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
  },
  {
    title: 'Trusted contacts',
    description: 'Pre-set contacts receive automatic trip notifications and can track rides in real time. Peace of mind for riders and their families.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    title: 'Post-ride reporting',
    description: 'Detailed incident reporting with trip timeline, driver info, and GPS data preserved for investigation. Every data point retained.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
];

// ── Page ──────────────────────────────────────────────────────────────────

export default function SafetyPage() {
  const scrolled = useScrolled();
  const fraudSection = useReveal(0.12);
  const driverSection = useReveal(0.15);
  const monitorSection = useReveal(0.12);
  const emergencySection = useReveal(0.15);
  const insuranceSection = useReveal(0.15);
  const emissionsSection = useReveal(0.15);
  const ctaSection = useReveal(0.2);

  const revealClass = (visible: boolean) =>
    `transition-all duration-[900ms] ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`;

  return (
    <div className="min-h-screen bg-white">

      {/* ═══ NAV ══════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled ? 'bg-white/80 backdrop-blur-2xl' : 'bg-transparent'
      }`}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] tracking-[0.01em] text-[#1d1d1f]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#86868b]">Mobility</span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 text-[14px] font-medium text-[#86868b] transition-colors duration-200 hover:text-[#1d1d1f]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back
          </Link>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="bg-white pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Safety
          </p>
          <h1 className="mt-5 max-w-[820px] text-[clamp(2.5rem,5.5vw,4rem)] font-bold leading-[1.08] tracking-[-0.035em] text-[#1d1d1f]">
            Safety is not a feature.{' '}
            <br className="hidden md:block" />
            It&apos;s the foundation.
          </h1>
          <p className="mt-6 max-w-[620px] text-[19px] leading-[1.6] text-[#6e6e73]">
            TakeMe was built safety-first. Every technical decision — from the dispatch algorithm to the payment architecture — is designed to protect riders, drivers, and communities. There are no bolt-on safety features here. Protection is structural, continuous, and transparent.
          </p>
        </div>
      </section>

      {/* ═══ FRAUD DETECTION ══════════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div
          ref={fraudSection.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 ${revealClass(fraudSection.visible)}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Fraud Intelligence
          </p>
          <h2 className="mt-4 max-w-[640px] text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Eight automated checks. Every single trip.
          </h2>
          <p className="mt-5 max-w-[620px] text-[17px] leading-[1.6] text-[#6e6e73]">
            A unified scoring engine runs 8 weighted checks in parallel the moment a trip completes. Scores above 70 flag for manual review. Above 90 trigger automatic cancellation and device ban.
          </p>

          <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {FRAUD_CHECKS.map((check) => (
              <div key={check.name} className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f5f7] text-[#1d1d1f]">
                  {check.icon}
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-[#1d1d1f]">{check.name}</h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#6e6e73]">{check.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DRIVER VERIFICATION ══════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={driverSection.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 ${revealClass(driverSection.visible)}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Driver Standards
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Every driver, verified.
          </h2>
          <p className="mt-5 max-w-[620px] text-[17px] leading-[1.6] text-[#6e6e73]">
            Multi-step verification before any driver can accept a ride. Background checks, document verification via AWS Rekognition and Claude AI review, vehicle inspection, and insurance verification. Ongoing monitoring — not just at signup.
          </p>

          <div className="mt-16 max-w-[680px]">
            {VERIFICATION_STEPS.map((item, i) => (
              <div key={item.step} className="relative flex gap-6">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1D6AE5] text-[13px] font-bold tabular-nums text-white">
                    {item.step}
                  </div>
                  {i < VERIFICATION_STEPS.length - 1 && (
                    <div className="w-[1px] flex-1 bg-[#d2d2d7]" />
                  )}
                </div>
                {/* Content */}
                <div className={`pb-12 ${i === VERIFICATION_STEPS.length - 1 ? 'pb-0' : ''}`}>
                  <h3 className="mt-2 text-[17px] font-semibold text-[#1d1d1f]">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.7] text-[#6e6e73]">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ RIDE MONITORING ══════════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div
          ref={monitorSection.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 ${revealClass(monitorSection.visible)}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Ride Monitoring
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Every ride, watched.
          </h2>
          <p className="mt-5 max-w-[620px] text-[17px] leading-[1.6] text-[#6e6e73]">
            From the moment a ride is requested to the moment it completes, TakeMe&apos;s systems are monitoring. Location streaming, route adherence, speed analysis, trip duration validation, and automatic anomaly detection.
          </p>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {MONITORING_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f5f7] text-[#1d1d1f]">
                  {feature.icon}
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-[#1d1d1f]">{feature.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.7] text-[#6e6e73]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ EMERGENCY FEATURES ═══════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={emergencySection.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 ${revealClass(emergencySection.visible)}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Emergency Response
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Help is always one tap away.
          </h2>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {EMERGENCY_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl bg-[#f5f5f7] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  {feature.icon}
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-[#1d1d1f]">{feature.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.7] text-[#6e6e73]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INSURANCE & COVERAGE ═════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div
          ref={insuranceSection.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 ${revealClass(insuranceSection.visible)}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Protection
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Covered from pickup to dropoff.
          </h2>
          <p className="mt-5 max-w-[620px] text-[17px] leading-[1.6] text-[#6e6e73]">
            Every TakeMe ride is backed by comprehensive insurance coverage. Commercial auto liability, uninsured motorist protection, and personal injury coverage — active for the entire duration of the trip.
          </p>

          <div className="mt-14 rounded-2xl bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-16">
              <div>
                <p className="text-[clamp(2rem,4vw,3.25rem)] font-bold tracking-[-0.03em] text-[#1d1d1f]">$1M</p>
                <p className="mt-1 text-[15px] leading-[1.6] text-[#6e6e73]">Per-incident commercial auto liability</p>
              </div>
              <div className="hidden h-16 w-[1px] bg-[#d2d2d7] md:block" />
              <div>
                <p className="text-[17px] font-semibold text-[#1d1d1f]">Uninsured motorist protection</p>
                <p className="mt-1 text-[15px] leading-[1.6] text-[#6e6e73]">Coverage against underinsured and uninsured third parties, active from ride acceptance to trip completion.</p>
              </div>
              <div className="hidden h-16 w-[1px] bg-[#d2d2d7] md:block" />
              <div>
                <p className="text-[17px] font-semibold text-[#1d1d1f]">Personal injury coverage</p>
                <p className="mt-1 text-[15px] leading-[1.6] text-[#6e6e73]">Medical expense coverage for riders and drivers in the event of an accident during an active trip.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ZERO EMISSIONS ═══════════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={emissionsSection.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 ${revealClass(emissionsSection.visible)}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Environmental Safety
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            The safest mile is a clean mile.
          </h2>
          <p className="mt-5 max-w-[620px] text-[17px] leading-[1.6] text-[#6e6e73]">
            TakeMe&apos;s 100% electric fleet eliminates tailpipe emissions. That means zero NOx, zero particulate matter, zero carbon monoxide in the neighborhoods where rides happen. Cleaner air is a public health outcome, and every ride contributes to it.
          </p>

          <div className="mt-14 grid grid-cols-3 gap-5">
            <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center md:p-8">
              <p className="text-[clamp(2rem,4vw,3.25rem)] font-bold tracking-[-0.03em] text-[#1D6AE5]">0g</p>
              <p className="mt-2 text-[14px] font-medium text-[#6e6e73]">CO2 per mile</p>
            </div>
            <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center md:p-8">
              <p className="text-[clamp(2rem,4vw,3.25rem)] font-bold tracking-[-0.03em] text-[#1D6AE5]">100%</p>
              <p className="mt-2 text-[14px] font-medium text-[#6e6e73]">Electric fleet</p>
            </div>
            <div className="rounded-2xl bg-[#f5f5f7] p-6 text-center md:p-8">
              <p className="text-[clamp(2rem,4vw,3.25rem)] font-bold tracking-[-0.03em] text-[#1D6AE5]">Zero</p>
              <p className="mt-2 text-[14px] font-medium text-[#6e6e73]">Tailpipe emissions</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ══════════════════════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div
          ref={ctaSection.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 ${revealClass(ctaSection.visible)}`}
        >
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#1d1d1f]">
              Your safety is our standard.
            </h2>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex h-[52px] items-center rounded-[999px] bg-[#1D6AE5] px-8 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#005bb5]"
              >
                Get started
              </Link>
              <Link
                href="/technology"
                className="inline-flex h-[52px] items-center rounded-[999px] border border-[#d2d2d7] px-8 text-[15px] font-medium text-[#1d1d1f] transition-colors duration-200 hover:bg-white"
              >
                Explore the technology
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#d2d2d7] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-14 lg:px-10">
          <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[17px] tracking-[0.01em] text-[#1d1d1f]">
                <span className="font-semibold">TakeMe</span>
                <span className="ml-[4px] font-light text-[#86868b]">Mobility</span>
              </div>
              <p className="mt-3 max-w-xs text-[14px] leading-[1.7] text-[#86868b]">
                Premium global transportation.<br />One standard, everywhere.
              </p>
            </div>
            <div className="flex gap-16">
              {[
                { t: 'Product', items: [
                  { label: 'Rides', href: '/#how-it-works' },
                  { label: 'Rental Cars', href: '/rentals' },
                  { label: 'Takeme Protection', href: '/protection' },
                  { label: 'Business', href: '/' },
                  { label: 'Pricing', href: '/' },
                ]},
                { t: 'Company', items: [
                  { label: 'About', href: '/' },
                  { label: 'Careers', href: '/' },
                  { label: 'Safety', href: '/safety' },
                  { label: 'Cities', href: '/' },
                  { label: 'Press', href: '/' },
                ]},
                { t: 'Legal', items: [
                  { label: 'Privacy', href: '/' },
                  { label: 'Terms', href: '/' },
                  { label: 'Cookies', href: '/' },
                ]},
              ].map((col) => (
                <div key={col.t}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">{col.t}</p>
                  <div className="mt-4 flex flex-col gap-3.5">
                    {col.items.map((item) => (
                      <Link key={item.label} href={item.href} className="text-[14px] text-[#6e6e73] transition-colors duration-200 hover:text-[#1d1d1f]">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[#d2d2d7] pt-8 md:flex-row md:items-center">
            <p className="text-[13px] text-[#86868b]">&copy; {new Date().getFullYear()} TakeMe Mobility Inc.</p>
            <div className="flex gap-7">
              {['Twitter', 'LinkedIn', 'Instagram'].map((s) => (
                <span key={s} className="cursor-pointer text-[13px] text-[#86868b] transition-colors duration-200 hover:text-[#6e6e73]">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
