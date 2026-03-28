'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/context';
import { GoogleMapsProvider } from '@/components/GoogleMapsProvider';
import HeroBooking from '@/components/HeroBooking';

// ── Data ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = ['Rides', 'Technology', 'Safety', 'Cities'] as const;

const TRUST_CARDS = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
      </svg>
    ),
    title: 'Real-time tracking',
    desc: 'See your driver approach on a live map. Share your trip with anyone.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
    title: 'Predictable pricing',
    desc: 'Fare locked at confirmation. No surge surprises, no hidden fees.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    title: 'Safety by design',
    desc: 'Verified drivers, trip monitoring, and 24/7 incident support.',
  },
];

const STEPS = [
  {
    title: 'Set your destination',
    description: 'Enter where you\'re going. See your exact fare and arrival time before you confirm anything.',
  },
  {
    title: 'A car arrives',
    description: 'Track a verified driver in real time. Name, photo, plate number — visible from the moment of match.',
  },
  {
    title: 'Arrive and go',
    description: 'Payment completes automatically. No fumbling, no tipping screens, no friction. Just go.',
  },
];

const CITIES = [
  { name: 'New York', country: 'US' },
  { name: 'London', country: 'UK' },
  { name: 'Zurich', country: 'CH' },
  { name: 'Berlin', country: 'DE' },
  { name: 'Paris', country: 'FR' },
  { name: 'Tokyo', country: 'JP' },
  { name: 'Singapore', country: 'SG' },
  { name: 'Dubai', country: 'AE' },
];

// ── Hooks ────────────────────────────────────────────────────────────────

function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false);
  const handler = useCallback(() => setScrolled(window.scrollY > threshold), [threshold]);
  useEffect(() => {
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
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading } = useAuth();
  const scrolled = useScrolled();
  const steps = useReveal(0.2);
  const citiesSection = useReveal(0.15);
  const closing = useReveal(0.2);

  const ctaHref = user ? '/dashboard' : '/auth/signup';
  const signInHref = user ? '/dashboard' : '/auth/login';

  return (
    <GoogleMapsProvider>
    <div className="min-h-screen bg-white">

      {/* ═══ NAV ══════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled ? 'bg-white/80 backdrop-blur-2xl' : 'bg-transparent'
      }`}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          {/* Logo */}
          <Link href="/" className="text-[18px] tracking-[0.01em] text-[#1D1D1F]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#8E8E93]">Mobility</span>
          </Link>

          {/* Nav */}
          <div className="hidden items-center gap-12 lg:flex">
            {NAV_ITEMS.map((item) => (
              <span key={item} className="cursor-pointer text-[14px] font-medium text-[#8E8E93] transition-opacity duration-250 hover:opacity-60">
                {item}
              </span>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-6">
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-[#D2D2D7] border-t-[#1D1D1F]" />
            ) : (
              <>
                <Link href={signInHref} className="hidden text-[14px] font-medium text-[#8E8E93] transition-opacity duration-250 hover:opacity-60 sm:block">
                  Sign in
                </Link>
                <Link
                  href={ctaHref}
                  className="inline-flex h-10 items-center rounded-[999px] bg-[#1D1D1F] px-5 text-[14px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO — Product-led ═══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_480px] lg:gap-16">

            {/* ── Left: headline + copy ─────────────────────────────────── */}
            <div className="pt-4 lg:pt-10">
              <div className="animate-fade-in">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#E8E8ED] px-4 py-2 text-[13px] font-medium text-[#6E6E73]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34C759] opacity-40" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34C759]" />
                  </span>
                  Live in 8 cities
                </span>
              </div>

              <h1 className="mt-8 text-[clamp(2.5rem,5.5vw,4.25rem)] font-bold leading-[1.08] tracking-[-0.035em] text-[#1D1D1F] animate-fade-in stagger-1">
                Your ride is already
                <br />
                on the way.
              </h1>

              <p className="mt-6 max-w-[420px] text-[19px] leading-[1.6] text-[#6E6E73] animate-fade-in stagger-2">
                Book in seconds. Track in real time.
                <br />
                Arrive with confidence.
              </p>

              <div className="mt-10 flex items-center gap-3.5 animate-fade-in stagger-3">
                <Link
                  href={ctaHref}
                  className="inline-flex h-[52px] items-center rounded-[999px] bg-[#1D1D1F] px-8 text-[16px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]"
                >
                  Get started
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex h-[52px] items-center rounded-[999px] border border-[#E0E0E0] px-8 text-[16px] font-medium text-[#1D1D1F] transition-colors duration-200 hover:bg-[#F5F5F7]"
                >
                  How it works
                </Link>
              </div>

              {/* Store badges */}
              <div className="mt-12 flex flex-wrap gap-3 animate-fade-in stagger-4">
                <a href="#" className="flex h-[52px] items-center gap-3 rounded-xl bg-[#1D1D1F] px-5 transition-colors duration-200 hover:bg-[#424245]">
                  <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.13 7.17 8.82 7.15C10.1 7.13 11.32 8.02 12.11 8.02C12.89 8.02 14.37 6.94 15.92 7.11C16.57 7.14 18.37 7.38 19.56 9.07C19.47 9.13 17.19 10.42 17.22 13.17C17.25 16.42 20.08 17.48 20.11 17.49C20.08 17.56 19.65 19.09 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium leading-none text-white/50">Download on the</span>
                    <span className="mt-0.5 text-[16px] font-semibold leading-tight text-white">App Store</span>
                  </div>
                </a>
                <a href="#" className="flex h-[52px] items-center gap-3 rounded-xl bg-[#1D1D1F] px-5 transition-colors duration-200 hover:bg-[#424245]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92z" fill="#4285F4" />
                    <path d="M16.657 8.893L5.536.497A1.005 1.005 0 014.39.56L14.727 10.9l1.93-2.007z" fill="#EA4335" />
                    <path d="M16.657 15.107l1.93 2.007 2.794-1.56a1 1 0 000-1.748l-2.795-1.56-1.93 2.008-.933.97.934-.117z" fill="#FBBC04" />
                    <path d="M4.39 23.44a1.005 1.005 0 001.146.063l11.12-8.396-1.929-2.007L4.39 23.44z" fill="#34A853" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium leading-none text-white/50">Get it on</span>
                    <span className="mt-0.5 text-[16px] font-semibold leading-tight text-white">Google Play</span>
                  </div>
                </a>
              </div>
            </div>

            {/* ── Right: Live Product UI ─────────────────────────────── */}
            <div className="animate-fade-in stagger-2">
              <HeroBooking ctaHref={ctaHref} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRUST LAYER ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#F5F5F7] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-16 md:py-20 lg:px-10">
          <div className="grid gap-4 md:grid-cols-3">
            {TRUST_CARDS.map((card) => (
              <div key={card.title} className="flex items-start gap-4 rounded-2xl bg-[#FAFAFA] p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#6E6E73] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  {card.icon}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1D1D1F]">{card.title}</h3>
                  <p className="mt-1 text-[14px] leading-[1.6] text-[#6E6E73]">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════════════════════ */}
      <section id="how-it-works" className="bg-[#F5F5F7]">
        <div
          ref={steps.ref}
          className={`mx-auto max-w-[1200px] px-6 py-28 md:py-36 lg:px-10 transition-all duration-[900ms] ease-out ${
            steps.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">How it works</p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1D1D1F]">
            Three steps. Zero complexity.
          </h2>

          <div className="mt-16 grid gap-14 md:grid-cols-3 md:gap-10">
            {STEPS.map((step, i) => (
              <div key={i}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  <span className="text-[16px] font-bold tabular-nums text-[#1D1D1F]">{i + 1}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-[#1D1D1F]">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.7] text-[#6E6E73]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CITIES ═══════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={citiesSection.ref}
          className={`mx-auto max-w-[1200px] px-6 py-28 md:py-36 lg:px-10 transition-all duration-[900ms] ease-out ${
            citiesSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">Coverage</p>
              <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1D1D1F]">
                One standard.
                <br />
                Every city.
              </h2>
            </div>
            <p className="max-w-sm text-[15px] leading-[1.7] text-[#6E6E73]">
              The same premium experience whether you're in Manhattan or Mayfair. More cities every quarter.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CITIES.map((c) => (
              <div
                key={c.name}
                className="group flex items-center justify-between rounded-2xl border border-[#F5F5F7] bg-[#FAFAFA] px-5 py-5 transition-all duration-200 hover:border-[#E8E8ED] hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
              >
                <div>
                  <span className="text-[15px] font-semibold text-[#1D1D1F]">{c.name}</span>
                  <span className="ml-2 text-[12px] font-medium text-[#A1A1A6]">{c.country}</span>
                </div>
                <span className="text-[#A1A1A6] transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CLOSING CTA ══════════════════════════════════════════════════ */}
      <section className="bg-[#F5F5F7]">
        <div
          ref={closing.ref}
          className={`mx-auto max-w-[1200px] px-6 py-28 md:py-36 lg:px-10 transition-all duration-[1s] ease-out ${
            closing.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <h2 className="text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[1.08] tracking-[-0.035em] text-[#1D1D1F]">
              Ready when you are.
            </h2>
            <p className="mt-5 max-w-md text-[17px] leading-[1.6] text-[#6E6E73]">
              Download TakeMe. Your first ride is on us.
            </p>
            <div className="mt-10">
              <Link
                href={ctaHref}
                className="inline-flex h-[52px] items-center rounded-[999px] bg-[#1D1D1F] px-8 text-[16px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]"
              >
                Get started
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#" className="flex h-[52px] items-center gap-3 rounded-xl bg-[#1D1D1F] px-5 transition-colors duration-200 hover:bg-[#424245]">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.13 7.17 8.82 7.15C10.1 7.13 11.32 8.02 12.11 8.02C12.89 8.02 14.37 6.94 15.92 7.11C16.57 7.14 18.37 7.38 19.56 9.07C19.47 9.13 17.19 10.42 17.22 13.17C17.25 16.42 20.08 17.48 20.11 17.49C20.08 17.56 19.65 19.09 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-[9px] font-medium leading-none text-white/50">Download on the</span>
                  <span className="mt-0.5 text-[14px] font-semibold leading-tight text-white">App Store</span>
                </div>
              </a>
              <a href="#" className="flex h-[52px] items-center gap-3 rounded-xl bg-[#1D1D1F] px-5 transition-colors duration-200 hover:bg-[#424245]">
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                  <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92z" fill="#4285F4" />
                  <path d="M16.657 8.893L5.536.497A1.005 1.005 0 014.39.56L14.727 10.9l1.93-2.007z" fill="#EA4335" />
                  <path d="M16.657 15.107l1.93 2.007 2.794-1.56a1 1 0 000-1.748l-2.795-1.56-1.93 2.008-.933.97.934-.117z" fill="#FBBC04" />
                  <path d="M4.39 23.44a1.005 1.005 0 001.146.063l11.12-8.396-1.929-2.007L4.39 23.44z" fill="#34A853" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-[9px] font-medium leading-none text-white/50">Get it on</span>
                  <span className="mt-0.5 text-[14px] font-semibold leading-tight text-white">Google Play</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#E8E8ED] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-14 lg:px-10">
          <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[17px] tracking-[0.01em] text-[#1D1D1F]">
                <span className="font-semibold">TakeMe</span>
                <span className="ml-[4px] font-light text-[#8E8E93]">Mobility</span>
              </div>
              <p className="mt-3 max-w-xs text-[14px] leading-[1.7] text-[#A1A1A6]">
                Premium global transportation.
                <br />
                One standard, everywhere.
              </p>
            </div>

            <div className="flex gap-16">
              {[
                { t: 'Product', items: ['Rides', 'Business', 'Cities', 'Pricing'] },
                { t: 'Company', items: ['About', 'Careers', 'Safety', 'Press'] },
                { t: 'Legal', items: ['Privacy', 'Terms', 'Cookies'] },
              ].map((col) => (
                <div key={col.t}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">{col.t}</p>
                  <div className="mt-4 flex flex-col gap-3.5">
                    {col.items.map((item) => (
                      <span key={item} className="cursor-pointer text-[14px] text-[#6E6E73] transition-colors duration-200 hover:text-[#1D1D1F]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[#E8E8ED] pt-8 md:flex-row md:items-center">
            <p className="text-[13px] text-[#A1A1A6]">&copy; {new Date().getFullYear()} TakeMe Mobility Inc.</p>
            <div className="flex gap-7">
              {['Twitter', 'LinkedIn', 'Instagram'].map((s) => (
                <span key={s} className="cursor-pointer text-[13px] text-[#A1A1A6] transition-colors duration-200 hover:text-[#6E6E73]">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
    </GoogleMapsProvider>
  );
}
