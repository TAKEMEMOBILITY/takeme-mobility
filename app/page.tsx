'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';
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

// Hero — street-level, wet pavement, headlight reflections, dark and cinematic
// Hero — premium sedan on city street at night, glass buildings, urban cinematic
const HERO_IMG = 'https://images.unsplash.com/photo-1685556636541-2904f9e7ef21?w=2400&q=90&auto=format&fit=crop';
// Secondary — black car in motion, Manhattan, motion blur, neon reflections
const SECONDARY_IMG = 'https://images.unsplash.com/photo-1727529488498-a498ef64e81b?w=1920&q=85&auto=format&fit=crop';

// ── Hooks ─────────────────────────────────────────────────────────────────

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback(() => setScrolled(window.scrollY > threshold), [threshold]);
  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);
  return scrolled;
}

// ── Closing statement — scroll-triggered fade ─────────────────────────────

function ClosingStatement({ href }: { href: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#040406]">
      {/* Subtle radial glow — prevents pure flat black */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(255,255,255,0.02),transparent)]" />

      <div
        ref={ref}
        className={`relative flex min-h-[75vh] flex-col items-center justify-center px-6 py-36 transition-all duration-[1.5s] ease-out md:py-48 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <h2 className="text-center text-[clamp(3.5rem,9vw,8rem)] font-bold leading-[0.85] tracking-[-0.045em] text-white">
          Pay. Ride. Go.
        </h2>
        <p className="mt-7 text-[15px] font-medium tracking-[-0.01em] text-white/20">
          With TakeMe.
        </p>

        <Link
          href={href}
          className="mt-16 rounded-full bg-[#ebebef] px-7 py-3.5 text-[14px] font-semibold text-[#050507] transition-opacity duration-300 hover:opacity-80 active:scale-[0.97]"
        >
          Get started
        </Link>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading } = useAuth();
  const scrolled = useScrolled();

  return (
    <div className="min-h-screen bg-[#040406]">

      {/* ═══ NAV ══════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-700 ${
        scrolled ? 'bg-[#040406]/90 backdrop-blur-2xl' : ''
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] font-semibold tracking-[-0.01em] text-white/90">
            TakeMe
          </Link>

          <div className="hidden items-center gap-9 lg:flex">
            {NAV_ITEMS.map((item) => (
              <span key={item} className="cursor-pointer text-[13px] font-medium text-white/35 transition-colors duration-300 hover:text-white/75">
                {item}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-6">
            {loading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/20 border-t-white/60" />
            ) : (
              <>
                <Link href={user ? '/dashboard' : '/auth/login'} className="text-[13px] font-medium text-white/35 transition-colors duration-300 hover:text-white/75">
                  Sign in
                </Link>
                <Link
                  href={user ? '/dashboard' : '/auth/signup'}
                  className="rounded-full border border-white/[0.1] px-5 py-2 text-[13px] font-semibold text-white/75 transition-all duration-300 hover:border-white/20 hover:text-white active:scale-[0.97]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden">
        {/* Image — car-focused, dark environment */}
        <div className="absolute inset-0">
          <Image
            src={HERO_IMG}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center animate-cinematic-zoom"
            unoptimized
          />
        </div>

        {/* Overlay system — heavy, cinematic, car as atmosphere not subject */}
        <div className="absolute inset-0 bg-black/[0.7]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#040406] via-[#040406]/60 to-[#040406]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#040406] via-[#040406]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#040406]/40 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_50%,transparent,#040406_90%)]" />

        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-10">
          <div className="max-w-2xl">
            <h1 className="text-[clamp(3.5rem,9vw,8rem)] font-bold leading-[0.88] tracking-[-0.045em] text-white">
              Move
              <br />
              without
              <br />
              friction.
            </h1>

            <p className="mt-8 max-w-xs text-[15px] leading-[1.8] text-white/30">
              Premium mobility, designed for clarity and control.
            </p>

            <div className="mt-10 flex items-center gap-4">
              <Link
                href={user ? '/dashboard' : '/auth/signup'}
                className="rounded-full bg-[#ebebef] px-7 py-3.5 text-[14px] font-semibold text-[#060608] transition-opacity duration-300 hover:opacity-80 active:scale-[0.97]"
              >
                Get started
              </Link>
              <Link
                href="#how-it-works"
                className="rounded-full border border-white/[0.1] px-7 py-3.5 text-[14px] font-semibold text-white/45 transition-all duration-300 hover:border-white/20 hover:text-white/75"
              >
                How it works
              </Link>
            </div>

            {/* Store badges */}
            <div className="mt-16 flex items-center gap-3">
              {[
                { label: 'App Store', sub: 'Download on the', icon: (
                  <svg className="h-[17px] w-[17px] text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.13 7.17 8.82 7.15C10.1 7.13 11.32 8.02 12.11 8.02C12.89 8.02 14.37 6.94 15.92 7.11C16.57 7.14 18.37 7.38 19.56 9.07C19.47 9.13 17.19 10.42 17.22 13.17C17.25 16.42 20.08 17.48 20.11 17.49C20.08 17.56 19.65 19.09 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/></svg>
                )},
                { label: 'Google Play', sub: 'Get it on', icon: (
                  <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24"><path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92z" fill="#4285F4"/><path d="M16.657 8.893L5.536.497A1.005 1.005 0 014.39.56L14.727 10.9l1.93-2.007z" fill="#EA4335"/><path d="M16.657 15.107l1.93 2.007 2.794-1.56a1 1 0 000-1.748l-2.795-1.56-1.93 2.008-.933.97.934-.117z" fill="#FBBC04"/><path d="M4.39 23.44a1.005 1.005 0 001.146.063l11.12-8.396-1.929-2.007L4.39 23.44z" fill="#34A853"/></svg>
                )},
              ].map((b) => (
                <a key={b.label} href="#" aria-label={b.label} className="flex h-[38px] items-center gap-2 rounded-lg border border-white/[0.06] px-3 transition-all duration-300 hover:border-white/[0.14] active:scale-[0.97]">
                  {b.icon}
                  <div className="flex flex-col">
                    <span className="text-[8px] font-medium leading-none text-white/20">{b.sub}</span>
                    <span className="mt-px text-[11px] font-semibold leading-none text-white/50">{b.label}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BREATHING SPACE ══════════════════════════════════════════════ */}
      <section className="py-32 md:py-48">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-10">
          <p className="text-[clamp(1.15rem,2.5vw,1.5rem)] font-normal leading-[1.6] tracking-[-0.005em] text-white/25">
            We built TakeMe for people who believe transportation
            should be invisible — perfectly reliable, effortlessly premium,
            the same in every city.
          </p>
        </div>
      </section>

      {/* ═══ SECONDARY IMAGE ══════════════════════════════════════════════ */}
      <section className="pb-32 md:pb-48">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="relative flex min-h-[55vh] items-center justify-center overflow-hidden rounded-2xl md:min-h-[70vh] md:rounded-3xl">
            <Image src={SECONDARY_IMG} alt="" fill className="object-cover" sizes="(max-width:1280px) 100vw, 1280px" unoptimized />
            <div className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,transparent,black_85%)]" />

            <div className="relative z-10 px-6 text-center">
              <h2 className="text-[clamp(1.75rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
                Arrive with certainty.
              </h2>
              <p className="mx-auto mt-5 max-w-xs text-[14px] leading-[1.8] text-white/30">
                The same vehicle, the same standard,
                in every city we serve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DARK → LIGHT TRANSITION ══════════════════════════════════════ */}
      <div className="h-24 bg-gradient-to-b from-[#060608] to-surface md:h-32" />

      {/* ═══ PILLARS ══════════════════════════════════════════════════════ */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40 lg:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-tertiary">Why TakeMe</p>
          <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            Transportation built on<br className="hidden md:block" /> a higher standard.
          </h2>
          <div className="mt-20 grid gap-16 md:grid-cols-3 md:gap-10">
            {PILLARS.map((p) => (
              <div key={p.number} className="group">
                <span className="text-[11px] font-semibold tabular-nums text-ink-tertiary">{p.number}</span>
                <div className="mt-4 mb-5 h-px w-8 bg-border transition-all duration-500 group-hover:w-16 group-hover:bg-ink-secondary" />
                <h3 className="text-[17px] font-semibold text-ink">{p.title}</h3>
                <p className="mt-3 text-[14px] leading-[1.8] text-ink-secondary">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════════════════════ */}
      <section id="how-it-works" className="bg-surface-secondary">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40 lg:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-tertiary">How it works</p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            Three steps. Zero complexity.
          </h2>
          <div className="mt-20 grid gap-14 md:grid-cols-3 md:gap-10">
            {[
              { s: 'Set your destination', d: 'Enter where you want to go. See the route, fare, and estimated time instantly.' },
              { s: 'Your vehicle arrives', d: 'Track a premium vehicle in real time as it comes directly to you.' },
              { s: 'Arrive and pay', d: 'Ride comfortably. Payment completes automatically when you arrive.' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[12px] font-bold tabular-nums text-white">{i + 1}</div>
                <h3 className="mt-5 text-[16px] font-semibold text-ink">{item.s}</h3>
                <p className="mt-2 text-[14px] leading-[1.8] text-ink-secondary">{item.d}</p>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-tertiary">Coverage</p>
              <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">One standard.<br />Every city.</h2>
            </div>
            <p className="max-w-sm text-[14px] leading-[1.8] text-ink-secondary">
              The same premium experience whether you&apos;re in Manhattan or Mayfair. More cities launching every quarter.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {CITIES.map((c) => (
              <div key={c} className="group flex items-center justify-between rounded-xl bg-surface-secondary px-5 py-4 transition-colors duration-300 hover:bg-surface-tertiary">
                <span className="text-[14px] font-medium text-ink">{c}</span>
                <span className="text-ink-tertiary transition-transform duration-300 group-hover:translate-x-0.5">&rarr;</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CLOSING — Final frame ═════════════════════════════════════════ */}
      <ClosingStatement href={user ? '/dashboard' : '/auth/signup'} />

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.05] bg-[#040406]">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="text-[15px] font-semibold text-white/70">TakeMe Mobility</span>
              <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-white/20">Premium global transportation. One standard of service, everywhere.</p>
            </div>
            <div className="flex gap-14">
              {[
                { t: 'Product', i: ['Rides', 'Business', 'Cities', 'Pricing'] },
                { t: 'Company', i: ['About', 'Careers', 'Safety', 'Contact'] },
                { t: 'Legal', i: ['Privacy', 'Terms', 'Cookies'] },
              ].map((col) => (
                <div key={col.t}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/15">{col.t}</p>
                  <div className="mt-4 flex flex-col gap-3">
                    {col.i.map((item) => (
                      <span key={item} className="cursor-pointer text-[13px] text-white/25 transition-colors duration-300 hover:text-white/55">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/[0.05] pt-8 md:flex-row md:items-center">
            <p className="text-[12px] text-white/15">&copy; {new Date().getFullYear()} TakeMe Mobility Inc.</p>
            <div className="flex gap-6">
              {['Twitter', 'LinkedIn', 'Instagram'].map((s) => (
                <span key={s} className="cursor-pointer text-[12px] text-white/15 transition-colors duration-300 hover:text-white/45">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
