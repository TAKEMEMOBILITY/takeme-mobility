'use client';

import Link from 'next/link';
import { useEffect, useRef, useCallback } from 'react';

// ── Scroll-reveal hook ──────────────────────────────────────────────────

function useReveal() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const setRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    refs.current[index] = el;
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = '1';
            (entry.target as HTMLElement).style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    refs.current.forEach((el) => {
      if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 900ms cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 900ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, []);

  return setRef;
}

// ── Fraud checks data ───────────────────────────────────────────────────

const FRAUD_CHECKS = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
      </svg>
    ),
    name: 'GPS spoofing detection',
    desc: 'Flags impossible speed transitions and teleportation events that indicate falsified location data.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    name: 'Minimum trip validation',
    desc: 'Detects ghost rides where trip duration or distance falls below physically plausible thresholds.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m6.115 5.19.319 1.913A6 6 0 0 0 8.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 0 0 2.288-4.042 1.087 1.087 0 0 0-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 0 1-.98-.314l-.295-.295a1.125 1.125 0 0 1 0-1.591l.13-.132a1.125 1.125 0 0 1 1.3-.21l.603.302a.809.809 0 0 0 1.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 0 0 1.528-1.732l.146-.292M6.115 5.19A9 9 0 1 0 17.18 4.64M6.115 5.19A8.965 8.965 0 0 1 12 3c1.929 0 3.716.607 5.18 1.64" />
      </svg>
    ),
    name: 'Route deviation analysis',
    desc: 'Compares the driven path against the estimated route to catch distance inflation and detour fraud.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
    name: 'Pickup/dropoff proximity',
    desc: 'Enforces geofence boundaries at both ends of every trip to prevent fare manipulation.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    name: 'Device ban enforcement',
    desc: 'Permanent hardware-level bans that survive account deletion, re-registration, and factory resets.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    name: 'Account reuse detection',
    desc: 'Cross-references phone numbers, device fingerprints, and email patterns to identify banned users.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    name: 'Driver-rider collusion',
    desc: 'Frequency pattern analysis detects repeated pairings that suggest coordinated fare exploitation.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
      </svg>
    ),
    name: 'Real-time score aggregation',
    desc: 'Weighted ensemble combines all check outputs into a unified 0-100 fraud score per trip.',
  },
];

// ── Component ───────────────────────────────────────────────────────────

export default function TechnologyPage() {
  const setRef = useReveal();
  let refIndex = 0;

  return (
    <div className="min-h-screen bg-white text-[#1D1D1F]">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E8E8ED]/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="text-[17px] tracking-[0.01em]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[4px] font-light text-[#8E8E93]">Mobility</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[14px] text-[#6E6E73] transition-colors duration-200 hover:text-[#1D1D1F]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="pb-20 pt-36 md:pb-28 md:pt-44">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div ref={setRef(refIndex++)} className="max-w-[720px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">
              Technology
            </p>
            <h1
              className="mt-4 font-bold leading-[1.08] tracking-[-0.035em] text-[#1D1D1F]"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
            >
              The infrastructure behind every ride.
            </h1>
            <p className="mt-6 max-w-[600px] text-[19px] leading-[1.6] text-[#6E6E73]">
              TakeMe Mobility is built on a vertically integrated technology stack purpose-engineered
              for all-electric rideshare. From sub-second dispatch to real-time fraud scoring,
              every layer is designed to move people safely, efficiently, and transparently.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 1: Intelligent Dispatch ─────────────────────────── */}
      <section className="bg-[#F5F5F7] py-24 md:py-32">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div ref={setRef(refIndex++)} className="max-w-[720px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">
              Real-time Matching
            </p>
            <h2
              className="mt-4 font-bold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F]"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Sub-5-second driver matching.
            </h2>
            <p className="mt-6 text-[17px] leading-[1.6] text-[#6E6E73]">
              Every ride request triggers a QStash event-driven dispatch pipeline that evaluates
              all eligible drivers in parallel. Candidates are scored across four weighted
              dimensions — proximity via PostGIS spatial queries, lifetime rating, rolling
              acceptance rate, and vehicle class fit — then ranked in real time. The top candidate
              receives a 15-second offer window. If the offer lapses, the system escalates
              automatically to the next tier. A dead-letter queue captures every failed dispatch
              for retry, ensuring no ride request is ever silently dropped.
            </p>
          </div>

          {/* Stats */}
          <div ref={setRef(refIndex++)} className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { value: '<5s', label: 'Average match time' },
              { value: '3-stage', label: 'Escalation pipeline' },
              { value: '99.7%', label: 'Dispatch success rate' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white p-6">
                <p className="text-[32px] font-bold tracking-[-0.02em] text-[#1D1D1F]">{stat.value}</p>
                <p className="mt-1 text-[15px] text-[#6E6E73]">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Feature grid */}
          <div ref={setRef(refIndex++)} className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.893 13.393l-1.135-1.135a2.252 2.252 0 0 1-.421-.585l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738.145l-.95.69a2.268 2.268 0 0 1-2.154.163L9 8.5l-.71 1.775a1.67 1.67 0 0 1-.746.86l-.255.152a3.097 3.097 0 0 0-1.257 1.34l-.455.91a1.518 1.518 0 0 0 .123 1.58l.38.508c.147.196.383.307.63.279l1.694-.192c.26-.03.465-.234.495-.493l.07-.594a1.725 1.725 0 0 1 1.028-1.378l.261-.108a1.745 1.745 0 0 1 1.364 0l.547.227a.75.75 0 0 0 .588 0l1.838-.766a.744.744 0 0 1 .937.381l.1.2a1.494 1.494 0 0 0 1.093.792l1.1.183a1.494 1.494 0 0 0 1.28-.444l.397-.397a1.482 1.482 0 0 0 .39-1.393Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
                  </svg>
                ),
                title: 'Spatial queries',
                desc: 'PostGIS-powered geospatial indexing returns the nearest eligible drivers in under 50ms.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                  </svg>
                ),
                title: 'Score-weighted assignment',
                desc: 'A composite ranking algorithm balances proximity, rating, and acceptance history in real time.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                ),
                title: 'Self-healing queue',
                desc: 'Dead-letter recovery automatically retries failed dispatches with exponential backoff.',
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F]">
                  {f.icon}
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[#1D1D1F]">{f.title}</p>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6E6E73]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 2: Live GPS Tracking ────────────────────────────── */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div ref={setRef(refIndex++)} className="max-w-[720px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">
              Real-time Location
            </p>
            <h2
              className="mt-4 font-bold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F]"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Sub-200ms location streaming.
            </h2>
            <p className="mt-6 text-[17px] leading-[1.6] text-[#6E6E73]">
              Every active driver publishes GPS coordinates at 1Hz over dedicated Ably WebSocket
              channels, including heading and speed vectors. The server authenticates and relays
              each update in under 200 milliseconds. On the rider side, the client subscribes
              to the assigned driver&apos;s channel and renders position updates on a live map
              with smooth interpolation. The result is a real-time view of your approaching
              vehicle that feels instantaneous.
            </p>
          </div>

          <div ref={setRef(refIndex++)} className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                ),
                title: 'Driver-to-rider streaming',
                desc: 'Continuous 1Hz GPS updates from driver to rider with heading, speed, and ETA recalculation on every frame.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                  </svg>
                ),
                title: 'Trip sharing',
                desc: 'Share a live tracking link with anyone. No app required — recipients watch the trip progress in a browser.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                  </svg>
                ),
                title: 'Geofenced arrival detection',
                desc: 'Automatic arrival notifications triggered when the driver enters a configurable radius around the pickup point.',
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl bg-[#FAFAFA] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F0F2] text-[#1D1D1F]">
                  {f.icon}
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[#1D1D1F]">{f.title}</p>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6E6E73]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Fraud & Safety AI ────────────────────────────── */}
      <section className="bg-[#F5F5F7] py-24 md:py-32">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div ref={setRef(refIndex++)} className="max-w-[720px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">
              Safety Intelligence
            </p>
            <h2
              className="mt-4 font-bold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F]"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Eight layers of fraud detection.
            </h2>
            <p className="mt-6 text-[17px] leading-[1.6] text-[#6E6E73]">
              A unified scoring engine evaluates every completed trip across eight independent checks,
              each running in parallel and returning a weighted sub-score. The results are aggregated
              into a single fraud score from 0 to 100. Trips scoring above 70 are flagged for manual
              review. Trips above 90 are auto-cancelled, the fare is reversed, and the account enters
              an escalation queue. The system is designed to catch fraud in real time without penalizing
              legitimate riders or drivers.
            </p>
          </div>

          <div ref={setRef(refIndex++)} className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FRAUD_CHECKS.map((check) => (
              <div key={check.name} className="rounded-2xl bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F]">
                  {check.icon}
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[#1D1D1F]">{check.name}</p>
                <p className="mt-1.5 text-[13px] leading-[1.6] text-[#6E6E73]">{check.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: EV Fleet Optimization ────────────────────────── */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div ref={setRef(refIndex++)} className="max-w-[720px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">
              Electric Fleet
            </p>
            <h2
              className="mt-4 font-bold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F]"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Built for electric from day one.
            </h2>
            <p className="mt-6 text-[17px] leading-[1.6] text-[#6E6E73]">
              TakeMe operates a 100% electric fleet. Our vehicle class system is architected around
              EV categories — Economy, Comfort, Premium, and SUV Electric — each with distinct
              performance profiles and range characteristics. The dispatch engine factors in real-time
              battery state of charge, ensuring low-charge vehicles are never assigned to long-distance
              trips. Integrated charging network partnerships keep the fleet on the road with minimal
              downtime between shifts.
            </p>
          </div>

          <div ref={setRef(refIndex++)} className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0 0 21 15.75v-6a2.25 2.25 0 0 0-2.25-2.25h-15A2.25 2.25 0 0 0 1.5 9.75v6A2.25 2.25 0 0 0 3.75 18Z" />
                  </svg>
                ),
                title: 'Battery-aware routing',
                desc: 'Dispatch considers real-time state of charge to prevent range anxiety and mid-trip charging stops.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                  </svg>
                ),
                title: 'Regenerative trip planning',
                desc: 'Route optimization accounts for elevation changes and regenerative braking to maximize effective range.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                  </svg>
                ),
                title: 'Charging network integration',
                desc: 'Direct API integrations with major charging networks surface real-time charger availability to drivers.',
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl bg-[#FAFAFA] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F0F2] text-[#1D1D1F]">
                  {f.icon}
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[#1D1D1F]">{f.title}</p>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6E6E73]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: Privacy & Security ───────────────────────────── */}
      <section className="bg-[#F5F5F7] py-24 md:py-32">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div ref={setRef(refIndex++)} className="max-w-[720px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">
              Privacy & Security
            </p>
            <h2
              className="mt-4 font-bold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F]"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Your data stays yours.
            </h2>
            <p className="mt-6 text-[17px] leading-[1.6] text-[#6E6E73]">
              Row-level security is enforced on every database table, ensuring users can only access
              their own records. Service-role separation guarantees that no client-side request can
              read another user&apos;s data. Payment processing runs entirely through Stripe for full
              PCI DSS compliance — we never see or store card numbers. Authentication is OTP-only,
              eliminating password databases entirely. Session cookies rotate automatically, and all
              data in transit is encrypted end-to-end.
            </p>
          </div>

          <div ref={setRef(refIndex++)} className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                ),
                title: 'End-to-end encryption',
                desc: 'All data encrypted in transit via TLS 1.3 and at rest with AES-256.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                  </svg>
                ),
                title: 'PCI DSS compliance',
                desc: 'Stripe handles all payment data. No card numbers touch our servers.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                ),
                title: 'SOC 2 practices',
                desc: 'Infrastructure follows SOC 2 Type II controls for access, logging, and monitoring.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                  </svg>
                ),
                title: 'Zero password architecture',
                desc: 'OTP-only authentication means there is no password database to breach.',
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F]">
                  {f.icon}
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[#1D1D1F]">{f.title}</p>
                <p className="mt-1.5 text-[13px] leading-[1.6] text-[#6E6E73]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-[1200px] px-6 text-center lg:px-10">
          <div ref={setRef(refIndex++)}>
            <h2
              className="font-bold leading-[1.08] tracking-[-0.03em] text-[#1D1D1F]"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Experience the technology.
            </h2>
            <p className="mx-auto mt-5 max-w-[480px] text-[17px] leading-[1.6] text-[#6E6E73]">
              Request your first ride and see the entire stack in action — from dispatch
              to tracking to seamless payment.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-[999px] bg-[#1D1D1F] px-8 py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]"
              >
                Get started
              </Link>
              <Link
                href="/safety"
                className="inline-flex items-center justify-center rounded-[999px] border border-[#E8E8ED] bg-white px-8 py-3.5 text-[15px] font-medium text-[#1D1D1F] transition-colors duration-200 hover:bg-[#F5F5F7]"
              >
                Learn about safety
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E8E8ED] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-14 lg:px-10">
          <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[17px] tracking-[0.01em] text-[#1D1D1F]">
                <span className="font-semibold">TakeMe</span>
                <span className="ml-[4px] font-light text-[#8E8E93]">Mobility</span>
              </div>
              <p className="mt-3 max-w-xs text-[14px] leading-[1.7] text-[#A1A1A6]">
                Premium global transportation.<br />One standard, everywhere.
              </p>
            </div>
            <div className="flex gap-16">
              {[
                { t: 'Product', items: [{l:'Rides',h:'/'},{l:'Technology',h:'/technology'},{l:'Safety',h:'/safety'},{l:'Cities',h:'/cities'}] },
                { t: 'Company', items: [{l:'About',h:'#'},{l:'Careers',h:'#'},{l:'Press',h:'#'}] },
                { t: 'Legal', items: [{l:'Privacy',h:'#'},{l:'Terms',h:'#'},{l:'Cookies',h:'#'}] },
              ].map((col) => (
                <div key={col.t}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">{col.t}</p>
                  <div className="mt-4 flex flex-col gap-3.5">
                    {col.items.map((item) => (
                      <Link key={item.l} href={item.h} className="text-[14px] text-[#6E6E73] transition-colors duration-200 hover:text-[#1D1D1F]">{item.l}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[#E8E8ED] pt-8 md:flex-row md:items-center">
            <p className="text-[13px] text-[#A1A1A6]">&copy; {new Date().getFullYear()} TakeMe Mobility Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
