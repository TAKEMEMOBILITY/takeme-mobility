'use client';

import Link from 'next/link';
import Image from 'next/image';
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

// ── Hero image ────────────────────────────────────────────────────────────
// Unsplash: Free for commercial use, no attribution required
// Black sedan in motion — clean, minimal, premium
const HERO_IMAGE = 'https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=1920&q=80&auto=format&fit=crop';
// Aerial city at night — for the secondary visual
const CITY_IMAGE = 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1600&q=80&auto=format&fit=crop';

// ── Component ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-surface text-ink">

      {/* ═══ NAVIGATION ═══════════════════════════════════════════════════ */}
      <nav className="fixed top-0 z-50 w-full bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="text-[20px] font-bold tracking-tight text-ink">
            TakeMe<span className="font-normal text-ink-tertiary">&nbsp;Mobility</span>
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {NAV_ITEMS.map((item) => (
              <span
                key={item}
                className="cursor-pointer text-[14px] font-medium text-ink-secondary transition-colors hover:text-ink"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-ink" />
            ) : user ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-ink/90 active:scale-[0.97]"
              >
                Open App
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="hidden text-[14px] font-medium text-ink-secondary transition-colors hover:text-ink sm:block"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-ink/90 active:scale-[0.97]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-ink">
        {/* Background image — darkened for text contrast */}
        <div className="absolute inset-0">
          <Image
            src={HERO_IMAGE}
            alt="Premium vehicle on a city road"
            fill
            className="object-cover object-center opacity-40"
            priority
            sizes="100vw"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/30" />
        </div>

        {/* Hero content */}
        <div className="relative mx-auto max-w-7xl px-6 pb-32 pt-40 md:pb-44 md:pt-52 lg:px-10">
          <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-white/50">
            Global Premium Mobility
          </p>

          <h1 className="mt-6 max-w-3xl text-[clamp(3rem,7.5vw,6.5rem)] font-bold leading-[0.95] tracking-tight text-white">
            Move without
            <br />
            friction.
          </h1>

          <p className="mt-8 max-w-lg text-[17px] leading-relaxed text-white/60">
            Premium transportation that works the way you expect.
            One tap, one standard, every city.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link
              href={user ? '/dashboard' : '/auth/signup'}
              className="rounded-full bg-white px-8 py-4 text-[15px] font-semibold text-ink transition-all duration-150 hover:bg-white/90 active:scale-[0.97]"
            >
              {user ? 'Open App' : 'Start riding'}
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-full border border-white/20 px-8 py-4 text-[15px] font-semibold text-white/80 transition-all duration-150 hover:border-white/40 hover:text-white"
            >
              How it works
            </Link>
          </div>

          {/* App download badges */}
          <div className="mt-14">
            <p className="text-[12px] font-medium uppercase tracking-[0.15em] text-white/30">
              Download the app
            </p>
            <div className="mt-4 flex items-center gap-3">
              {/* App Store badge */}
              <a
                href="#"
                aria-label="Download on the App Store"
                className="group flex h-[44px] items-center gap-2.5 rounded-[10px] border border-white/15 bg-white/5 px-4 transition-all duration-150 hover:border-white/30 hover:bg-white/10 active:scale-[0.97]"
              >
                <svg className="h-[22px] w-[22px] text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.13 7.17 8.82 7.15C10.1 7.13 11.32 8.02 12.11 8.02C12.89 8.02 14.37 6.94 15.92 7.11C16.57 7.14 18.37 7.38 19.56 9.07C19.47 9.13 17.19 10.42 17.22 13.17C17.25 16.42 20.08 17.48 20.11 17.49C20.08 17.56 19.65 19.09 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                </svg>
                <div className="flex flex-col">
                  <span className="text-[9px] font-medium leading-none text-white/50">Download on the</span>
                  <span className="mt-0.5 text-[14px] font-semibold leading-none text-white">App Store</span>
                </div>
              </a>

              {/* Google Play badge */}
              <a
                href="#"
                aria-label="Get it on Google Play"
                className="group flex h-[44px] items-center gap-2.5 rounded-[10px] border border-white/15 bg-white/5 px-4 transition-all duration-150 hover:border-white/30 hover:bg-white/10 active:scale-[0.97]"
              >
                <svg className="h-[20px] w-[20px]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92z" fill="#4285F4"/>
                  <path d="M16.657 8.893L5.536.497A1.005 1.005 0 014.39.56L14.727 10.9l1.93-2.007z" fill="#EA4335"/>
                  <path d="M16.657 15.107l1.93 2.007 2.794-1.56a1 1 0 000-1.748l-2.795-1.56-1.93 2.008-.933.97.934-.117z" fill="#FBBC04"/>
                  <path d="M4.39 23.44a1.005 1.005 0 001.146.063l11.12-8.396-1.929-2.007L4.39 23.44z" fill="#34A853"/>
                </svg>
                <div className="flex flex-col">
                  <span className="text-[9px] font-medium leading-none text-white/50">Get it on</span>
                  <span className="mt-0.5 text-[14px] font-semibold leading-none text-white">Google Play</span>
                </div>
              </a>
            </div>
          </div>
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
          <div className="grid items-center gap-16 md:grid-cols-2">
            {/* Left — copy */}
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-ink-tertiary">
                How it works
              </p>
              <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-ink">
                Three steps.<br />
                Zero complexity.
              </h2>

              <div className="mt-14 space-y-10">
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

            {/* Right — city image */}
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl md:aspect-auto md:h-full md:min-h-[500px]">
              <Image
                src={CITY_IMAGE}
                alt="Aerial view of a connected city at night"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          </div>
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
            {/* Brand */}
            <div>
              <span className="text-[16px] font-bold text-ink">TakeMe Mobility</span>
              <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-ink-tertiary">
                Premium global transportation. One standard of service, everywhere.
              </p>
            </div>

            {/* Link columns */}
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

          {/* Bottom bar */}
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
