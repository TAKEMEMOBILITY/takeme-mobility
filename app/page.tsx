'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';

// ── Data ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = ['Rides', 'Technology', 'Safety', 'Cities'] as const;

const PILLARS = [
  {
    number: '01',
    title: 'Built for trust',
    description: 'Real-time vehicle tracking, verified drivers, and trip sharing. Every ride monitored to the highest global safety standards.',
  },
  {
    number: '02',
    title: 'Precision reliability',
    description: 'AI-optimized routing, accurate ETAs, and consistent availability. The same quality in every city we operate.',
  },
  {
    number: '03',
    title: 'Effortless experience',
    description: 'Set your destination. A premium vehicle arrives. Pay seamlessly on arrival. Nothing else to think about.',
  },
];

const CITIES = ['New York', 'London', 'Zurich', 'Berlin', 'Paris', 'Tokyo', 'Singapore', 'Dubai'];

// Hero image — Unsplash: cinematic city with motion blur, dark tones
// Free for commercial use, no attribution required
const HERO_IMAGE = 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=2400&q=85&auto=format&fit=crop';
// Secondary — abstract city at dusk, glass and light
const SECONDARY_IMAGE = 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&q=85&auto=format&fit=crop';

// ── Scroll-aware navbar ───────────────────────────────────────────────────

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return scrolled;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading } = useAuth();
  const scrolled = useScrolled();

  return (
    <div className="min-h-screen bg-[#08080a]">

      {/* ═══ NAVIGATION ═══════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled ? 'bg-[#08080a]/80 backdrop-blur-2xl' : ''
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[19px] font-semibold tracking-tight text-white/90">
            TakeMe
          </Link>

          <div className="hidden items-center gap-9 lg:flex">
            {NAV_ITEMS.map((item) => (
              <span
                key={item}
                className="cursor-pointer text-[13px] font-medium text-white/40 transition-colors duration-300 hover:text-white/80"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-6">
            {loading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/20 border-t-white/70" />
            ) : (
              <>
                <Link
                  href={user ? '/dashboard' : '/auth/login'}
                  className="text-[13px] font-medium text-white/40 transition-colors duration-300 hover:text-white/80"
                >
                  Sign in
                </Link>
                <Link
                  href={user ? '/dashboard' : '/auth/signup'}
                  className="rounded-full border border-white/[0.12] px-5 py-2 text-[13px] font-semibold text-white/80 transition-all duration-300 hover:border-white/25 hover:text-white active:scale-[0.97]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════
          Full viewport. Cinematic image with slow zoom animation.
          Left-to-right gradient keeps text readable on the left
          while the image breathes on the right.
          The zoom (1.03 → 1.08 over 25s) creates life.
          ═════════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden">
        {/* Background image with cinematic zoom */}
        <div className="absolute inset-0">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover animate-cinematic-zoom"
            unoptimized
          />
        </div>

        {/* Overlay system — 4 layers for depth and readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#08080a]/80 via-[#08080a]/40 to-[#08080a]/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080a]/60 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#08080a]/35 to-transparent" />
        <div className="absolute inset-0 bg-blue-950/[0.05]" />

        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-10">
          <div className="max-w-xl">
            <h1 className="text-[clamp(2.75rem,6.5vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-white">
              Move without
              <br />
              friction.
            </h1>

            <p className="mt-7 max-w-sm text-[15px] leading-[1.8] text-white/40">
              Premium mobility, designed for clarity and control.
              One standard of service, every city.
            </p>

            <div className="mt-10 flex items-center gap-4">
              <Link
                href={user ? '/dashboard' : '/auth/signup'}
                className="rounded-full bg-[#f0f0f3] px-7 py-3.5 text-[14px] font-semibold text-[#08080a] transition-opacity duration-300 hover:opacity-85 active:scale-[0.97]"
              >
                Get started
              </Link>
              <Link
                href="#how-it-works"
                className="rounded-full border border-white/[0.12] px-7 py-3.5 text-[14px] font-semibold text-white/50 transition-all duration-300 hover:border-white/25 hover:text-white/80"
              >
                How it works
              </Link>
            </div>

            {/* App store badges */}
            <div className="mt-16 flex items-center gap-3">
              {[
                { label: 'App Store', sub: 'Download on the', icon: (
                  <svg className="h-[18px] w-[18px] text-white/70" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.13 7.17 8.82 7.15C10.1 7.13 11.32 8.02 12.11 8.02C12.89 8.02 14.37 6.94 15.92 7.11C16.57 7.14 18.37 7.38 19.56 9.07C19.47 9.13 17.19 10.42 17.22 13.17C17.25 16.42 20.08 17.48 20.11 17.49C20.08 17.56 19.65 19.09 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                  </svg>
                )},
                { label: 'Google Play', sub: 'Get it on', icon: (
                  <svg className="h-[16px] w-[16px]" viewBox="0 0 24 24">
                    <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92z" fill="#4285F4"/>
                    <path d="M16.657 8.893L5.536.497A1.005 1.005 0 014.39.56L14.727 10.9l1.93-2.007z" fill="#EA4335"/>
                    <path d="M16.657 15.107l1.93 2.007 2.794-1.56a1 1 0 000-1.748l-2.795-1.56-1.93 2.008-.933.97.934-.117z" fill="#FBBC04"/>
                    <path d="M4.39 23.44a1.005 1.005 0 001.146.063l11.12-8.396-1.929-2.007L4.39 23.44z" fill="#34A853"/>
                  </svg>
                )},
              ].map((badge) => (
                <a
                  key={badge.label}
                  href="#"
                  aria-label={badge.label}
                  className="flex h-[40px] items-center gap-2 rounded-lg border border-white/[0.08] px-3.5 transition-all duration-300 hover:border-white/[0.18] active:scale-[0.97]"
                >
                  {badge.icon}
                  <div className="flex flex-col">
                    <span className="text-[8px] font-medium leading-none text-white/25">{badge.sub}</span>
                    <span className="mt-px text-[12px] font-semibold leading-none text-white/60">{badge.label}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BREATHING SPACE ══════════════════════════════════════════════ */}
      <section className="bg-[#08080a] py-32 md:py-44">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[clamp(1.25rem,3vw,1.75rem)] font-normal leading-[1.5] tracking-[-0.01em] text-white/30">
              We built TakeMe for people who believe transportation
              should be invisible — perfectly reliable, effortlessly premium,
              the same in every city.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ SECONDARY IMAGE — Inset cinematic section ════════════════════ */}
      <section className="bg-[#08080a] pb-32 md:pb-44">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="relative flex min-h-[55vh] items-center justify-center overflow-hidden rounded-2xl md:min-h-[70vh] md:rounded-3xl">
            <Image
              src={SECONDARY_IMAGE}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1280px) 100vw, 1280px"
              unoptimized
            />
            <div className="absolute inset-0 bg-black/45" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

            <div className="relative z-10 px-6 text-center">
              <h2 className="text-[clamp(1.75rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
                Arrive with certainty.
              </h2>
              <p className="mx-auto mt-5 max-w-xs text-[14px] leading-[1.8] text-white/35">
                The same vehicle, the same standard,
                in every city we serve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRANSITION TO LIGHT ══════════════════════════════════════════ */}
      <div className="h-24 bg-gradient-to-b from-[#08080a] to-surface md:h-32" />

      {/* ═══ PILLARS ══════════════════════════════════════════════════════ */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40 lg:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-tertiary">
            Why TakeMe
          </p>
          <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            Transportation built on
            <br className="hidden md:block" />
            a higher standard.
          </h2>

          <div className="mt-20 grid gap-16 md:grid-cols-3 md:gap-10">
            {PILLARS.map((pillar) => (
              <div key={pillar.number} className="group">
                <span className="text-[11px] font-semibold tabular-nums text-ink-tertiary">{pillar.number}</span>
                <div className="mt-4 mb-5 h-px w-8 bg-border transition-all duration-500 group-hover:w-16 group-hover:bg-ink-secondary" />
                <h3 className="text-[17px] font-semibold text-ink">{pillar.title}</h3>
                <p className="mt-3 text-[14px] leading-[1.8] text-ink-secondary">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════════════════════ */}
      <section id="how-it-works" className="bg-surface-secondary">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40 lg:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-tertiary">
            How it works
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            Three steps. Zero complexity.
          </h2>

          <div className="mt-20 grid gap-14 md:grid-cols-3 md:gap-10">
            {[
              { step: 'Set your destination', detail: 'Enter where you want to go. See the route, fare, and estimated time instantly.' },
              { step: 'Your vehicle arrives', detail: 'Track a premium vehicle in real time as it comes directly to you.' },
              { step: 'Arrive and pay', detail: 'Ride comfortably. Payment completes automatically when you arrive.' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[12px] font-bold tabular-nums text-white">
                  {i + 1}
                </div>
                <h3 className="mt-5 text-[16px] font-semibold text-ink">{item.step}</h3>
                <p className="mt-2 text-[14px] leading-[1.8] text-ink-secondary">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CITIES ═══════════════════════════════════════════════════════ */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40 lg:px-10">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-tertiary">
                Coverage
              </p>
              <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
                One standard.<br />
                Every city.
              </h2>
            </div>
            <p className="max-w-sm text-[14px] leading-[1.8] text-ink-secondary">
              The same premium experience whether you&apos;re in Manhattan or Mayfair.
              More cities launching every quarter.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {CITIES.map((city) => (
              <div
                key={city}
                className="group flex items-center justify-between rounded-xl bg-surface-secondary px-5 py-4 transition-colors duration-300 hover:bg-surface-tertiary"
              >
                <span className="text-[14px] font-medium text-ink">{city}</span>
                <span className="text-ink-tertiary transition-transform duration-300 group-hover:translate-x-0.5">&rarr;</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ════════════════════════════════════════════════════ */}
      <section className="bg-[#08080a]">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40 lg:px-10">
          <div className="max-w-xl">
            <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-white">
              Your city, seamlessly
              <br />
              connected.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-[1.8] text-white/35">
              Join the mobility platform built for people who
              expect more from getting around.
            </p>
            <div className="mt-12 flex items-center gap-4">
              <Link
                href={user ? '/dashboard' : '/auth/signup'}
                className="rounded-full bg-[#f0f0f3] px-7 py-3.5 text-[14px] font-semibold text-[#08080a] transition-opacity duration-300 hover:opacity-85 active:scale-[0.97]"
              >
                {user ? 'Go to Dashboard' : 'Create your account'}
              </Link>
              <Link
                href="/auth/login"
                className="rounded-full border border-white/[0.12] px-7 py-3.5 text-[14px] font-semibold text-white/40 transition-all duration-300 hover:border-white/25 hover:text-white/70"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.06] bg-[#08080a]">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="text-[15px] font-semibold text-white/80">TakeMe Mobility</span>
              <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-white/25">
                Premium global transportation. One standard of service, everywhere.
              </p>
            </div>

            <div className="flex gap-14">
              {[
                { title: 'Product', items: ['Rides', 'Business', 'Cities', 'Pricing'] },
                { title: 'Company', items: ['About', 'Careers', 'Safety', 'Contact'] },
                { title: 'Legal', items: ['Privacy', 'Terms', 'Cookies'] },
              ].map((col) => (
                <div key={col.title}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">{col.title}</p>
                  <div className="mt-4 flex flex-col gap-3">
                    {col.items.map((item) => (
                      <span key={item} className="cursor-pointer text-[13px] text-white/30 transition-colors duration-300 hover:text-white/60">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-8 md:flex-row md:items-center">
            <p className="text-[12px] text-white/20">
              &copy; {new Date().getFullYear()} TakeMe Mobility Inc.
            </p>
            <div className="flex gap-6">
              {['Twitter', 'LinkedIn', 'Instagram'].map((social) => (
                <span key={social} className="cursor-pointer text-[12px] text-white/20 transition-colors duration-300 hover:text-white/50">{social}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
