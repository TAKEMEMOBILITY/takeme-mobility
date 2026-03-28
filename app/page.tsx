'use client';

import Link from 'next/link';
import { useRef, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';

// ── Data ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = ['Rides', 'Technology', 'Safety', 'Cities'] as const;

const PILLARS = [
  {
    number: '01',
    title: 'Built for trust',
    description: 'Real-time vehicle tracking, verified drivers, and trip sharing. Every ride is monitored to the highest global safety standards.',
  },
  {
    number: '02',
    title: 'Precision reliability',
    description: 'AI-optimized routing, accurate ETAs, and consistent availability. The same quality of service in every city we operate.',
  },
  {
    number: '03',
    title: 'Effortless experience',
    description: 'Set your destination. A premium vehicle arrives. Pay seamlessly when you arrive. Nothing else to think about.',
  },
];

const CITIES = ['New York', 'London', 'Zurich', 'Berlin', 'Paris', 'Tokyo', 'Singapore', 'Dubai'];

const STATS = [
  { value: '12', unit: 'Cities', label: 'and growing' },
  { value: '99.8', unit: '%', label: 'On-time arrival' },
  { value: '4.9', unit: '/ 5', label: 'Rider rating' },
];

// ── Video component — reusable cinematic background ───────────────────────

function CinematicVideo({
  src,
  className = '',
  overlay = 'bg-black/50',
}: {
  src: string;
  className?: string;
  overlay?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Respect reduced motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      video.pause();
      // Show first frame as a poster
      video.currentTime = 0;
      setLoaded(true);
      return;
    }

    const handleCanPlay = () => setLoaded(true);
    video.addEventListener('canplay', handleCanPlay);

    // Attempt play — browsers may block autoplay
    video.play().catch(() => {
      // Autoplay blocked — show first frame as fallback
      video.currentTime = 0;
      setLoaded(true);
    });

    return () => video.removeEventListener('canplay', handleCanPlay);
  }, []);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={`h-full w-full object-cover transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Overlay for text readability */}
      <div className={`absolute inset-0 ${overlay}`} />
      {/* Loading state — solid dark until video loads */}
      {!loaded && <div className="absolute inset-0 bg-ink" />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-surface text-ink">

      {/* ═══ NAVIGATION ═══════════════════════════════════════════════════ */}
      <nav className="fixed top-0 z-50 w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[20px] font-bold tracking-tight text-white">
            TakeMe<span className="font-normal text-white/50">&nbsp;Mobility</span>
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {NAV_ITEMS.map((item) => (
              <span
                key={item}
                className="cursor-pointer text-[14px] font-medium text-white/60 transition-colors hover:text-white"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-6">
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <Link
                  href={user ? '/dashboard' : '/auth/login'}
                  className="text-[14px] font-medium text-white/60 transition-colors hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  href={user ? '/dashboard' : '/auth/signup'}
                  className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-[14px] font-semibold text-white transition-all duration-150 hover:border-white/35 hover:bg-white/10 active:scale-[0.97]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO — Full viewport, video background ═══════════════════════ */}
      <section className="relative flex min-h-screen items-end bg-ink">
        <CinematicVideo
          src="/videos/takeme.mp4"
          overlay="bg-gradient-to-t from-black/80 via-black/40 to-black/20"
        />

        {/* Hero content — positioned at the bottom for cinematic breathing room */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 md:pb-24 lg:px-10">
          <h1 className="max-w-3xl text-[clamp(3rem,7.5vw,6.5rem)] font-bold leading-[0.95] tracking-tight text-white">
            Move without
            <br />
            friction.
          </h1>

          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-white/55">
            Premium transportation that works the way you expect.
            One tap, one standard, every city.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={user ? '/dashboard' : '/auth/signup'}
              className="rounded-full bg-white px-8 py-4 text-[15px] font-semibold text-ink transition-all duration-150 hover:bg-white/90 active:scale-[0.97]"
            >
              {user ? 'Open App' : 'Start riding'}
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-full border border-white/20 px-8 py-4 text-[15px] font-semibold text-white/70 transition-all duration-150 hover:border-white/40 hover:text-white"
            >
              How it works
            </Link>
          </div>

          {/* App store badges */}
          <div className="mt-12 flex items-center gap-3">
            <a
              href="#"
              aria-label="Download on the App Store"
              className="flex h-[42px] items-center gap-2.5 rounded-[10px] border border-white/12 bg-white/5 px-4 transition-all duration-150 hover:border-white/25 hover:bg-white/10 active:scale-[0.97]"
            >
              <svg className="h-[20px] w-[20px] text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.13 7.17 8.82 7.15C10.1 7.13 11.32 8.02 12.11 8.02C12.89 8.02 14.37 6.94 15.92 7.11C16.57 7.14 18.37 7.38 19.56 9.07C19.47 9.13 17.19 10.42 17.22 13.17C17.25 16.42 20.08 17.48 20.11 17.49C20.08 17.56 19.65 19.09 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
              </svg>
              <div className="flex flex-col">
                <span className="text-[9px] font-medium leading-none text-white/40">Download on the</span>
                <span className="mt-0.5 text-[13px] font-semibold leading-none text-white">App Store</span>
              </div>
            </a>
            <a
              href="#"
              aria-label="Get it on Google Play"
              className="flex h-[42px] items-center gap-2.5 rounded-[10px] border border-white/12 bg-white/5 px-4 transition-all duration-150 hover:border-white/25 hover:bg-white/10 active:scale-[0.97]"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92z" fill="#4285F4"/>
                <path d="M16.657 8.893L5.536.497A1.005 1.005 0 014.39.56L14.727 10.9l1.93-2.007z" fill="#EA4335"/>
                <path d="M16.657 15.107l1.93 2.007 2.794-1.56a1 1 0 000-1.748l-2.795-1.56-1.93 2.008-.933.97.934-.117z" fill="#FBBC04"/>
                <path d="M4.39 23.44a1.005 1.005 0 001.146.063l11.12-8.396-1.929-2.007L4.39 23.44z" fill="#34A853"/>
              </svg>
              <div className="flex flex-col">
                <span className="text-[9px] font-medium leading-none text-white/40">Get it on</span>
                <span className="mt-0.5 text-[13px] font-semibold leading-none text-white">Google Play</span>
              </div>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
          <div className="h-8 w-[1px] animate-pulse bg-gradient-to-b from-transparent to-white/30" />
        </div>
      </section>

      {/* ═══ STATS BAR ════════════════════════════════════════════════════ */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-border px-6 lg:px-10">
          {STATS.map((stat) => (
            <div key={stat.label} className="py-10 text-center md:py-14">
              <p className="text-3xl font-bold tabular-nums text-ink md:text-4xl">
                {stat.value}<span className="text-lg font-semibold text-ink-tertiary md:text-xl">{stat.unit}</span>
              </p>
              <p className="mt-1 text-[13px] text-ink-tertiary">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PILLARS ══════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:py-36 lg:px-10">
        <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-ink-tertiary">
          Why TakeMe
        </p>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-ink">
          Transportation built on<br className="hidden md:block" />
          a higher standard.
        </h2>

        <div className="mt-20 grid gap-16 md:grid-cols-3 md:gap-12">
          {PILLARS.map((pillar) => (
            <div key={pillar.number} className="group">
              <span className="text-[13px] font-semibold tabular-nums text-ink-tertiary">{pillar.number}</span>
              <div className="mt-4 mb-4 h-px w-12 bg-border transition-all duration-300 group-hover:w-20 group-hover:bg-ink" />
              <h3 className="text-[18px] font-semibold text-ink">{pillar.title}</h3>
              <p className="mt-3 text-[15px] leading-[1.7] text-ink-secondary">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════════════════════ */}
      <section id="how-it-works" className="bg-surface-secondary">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-36 lg:px-10">
          <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-ink-tertiary">
            How it works
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-ink">
            Three steps.<br />
            Zero complexity.
          </h2>

          <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-16">
            {[
              { step: 'Set your destination', detail: 'Enter where you want to go. See the route, fare, and estimated time instantly.' },
              { step: 'Your vehicle arrives', detail: 'Track a premium vehicle in real time as it comes directly to you.' },
              { step: 'Arrive and pay', detail: 'Ride comfortably. Payment completes automatically when you arrive.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">
                  {i + 1}
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-ink">{item.step}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-secondary">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CINEMATIC BREAK — Second video, single statement ═════════════ */}
      <section className="relative flex min-h-[70vh] items-center justify-center bg-ink md:min-h-[80vh]">
        <CinematicVideo
          src="/videos/takeme2.mp4"
          overlay="bg-black/55"
        />

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-white/40">
            The TakeMe Standard
          </p>
          <h2 className="mt-6 text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-white">
            Same vehicle. Same service.<br className="hidden sm:block" />
            Every city in the world.
          </h2>
          <p className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-white/50">
            We don&apos;t localize quality. Whether you&apos;re in Zurich
            or Singapore, the experience is identical.
          </p>
        </div>
      </section>

      {/* ═══ CITIES ═══════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:py-36 lg:px-10">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-ink-tertiary">
              Coverage
            </p>
            <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-ink">
              One standard.<br />
              Every city.
            </h2>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink-secondary">
            The same premium experience whether you&apos;re in Manhattan or Mayfair. More cities launching every quarter.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CITIES.map((city) => (
            <div
              key={city}
              className="group flex items-center justify-between rounded-xl bg-surface-secondary px-5 py-4 transition-colors hover:bg-surface-tertiary"
            >
              <span className="text-[15px] font-medium text-ink">{city}</span>
              <span className="text-ink-tertiary transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FINAL CTA ════════════════════════════════════════════════════ */}
      <section className="bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-36 lg:px-10">
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-white">
              Your city, seamlessly
              <br />
              connected.
            </h2>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/50">
              Join the mobility platform built for people who
              expect more from getting around.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-4">
              <Link
                href={user ? '/dashboard' : '/auth/signup'}
                className="rounded-full bg-white px-8 py-4 text-[15px] font-semibold text-ink transition-all duration-150 hover:bg-white/90 active:scale-[0.97]"
              >
                {user ? 'Go to Dashboard' : 'Create your account'}
              </Link>
              <Link
                href="/auth/login"
                className="rounded-full border border-white/15 px-8 py-4 text-[15px] font-semibold text-white/60 transition-all duration-150 hover:border-white/30 hover:text-white"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="text-[16px] font-bold text-ink">TakeMe Mobility</span>
              <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-ink-tertiary">
                Premium global transportation. One standard of service, everywhere.
              </p>
            </div>

            <div className="flex gap-16">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-tertiary">Product</p>
                <div className="mt-4 flex flex-col gap-3">
                  {['Rides', 'Business', 'Cities', 'Pricing'].map((item) => (
                    <span key={item} className="cursor-pointer text-[14px] text-ink-secondary transition-colors hover:text-ink">{item}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-tertiary">Company</p>
                <div className="mt-4 flex flex-col gap-3">
                  {['About', 'Careers', 'Safety', 'Contact'].map((item) => (
                    <span key={item} className="cursor-pointer text-[14px] text-ink-secondary transition-colors hover:text-ink">{item}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-tertiary">Legal</p>
                <div className="mt-4 flex flex-col gap-3">
                  {['Privacy', 'Terms', 'Cookies'].map((item) => (
                    <span key={item} className="cursor-pointer text-[14px] text-ink-secondary transition-colors hover:text-ink">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 md:flex-row md:items-center">
            <p className="text-[13px] text-ink-tertiary">
              &copy; {new Date().getFullYear()} TakeMe Mobility Inc. All rights reserved.
            </p>
            <div className="flex gap-6">
              {['Twitter', 'LinkedIn', 'Instagram'].map((social) => (
                <span key={social} className="cursor-pointer text-[13px] text-ink-tertiary transition-colors hover:text-ink">{social}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
