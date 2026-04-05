'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/context';
import HeroBookingWrapper from '@/components/HeroBookingWrapper';
import dynamic from 'next/dynamic';

const HeroCanvas = dynamic(() => import('@/components/HeroCanvas'), { ssr: false });

// ── Data ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'TakeMe Fleet', href: '/fleet', badge: true },
  { label: 'Business', href: '/business', badge: false },
  { label: 'TakeMe Connect', href: '/connect', badge: true },
  { label: 'Students Membership', href: '/students', badge: true },
  { label: 'Driver Hub', href: '/driver-hub', badge: true },
];

const TRUST_CARDS = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
      </svg>
    ),
    title: 'Live tracking',
    desc: 'Watch your driver arrive on a live map. Share your trip instantly.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
    title: 'Upfront pricing',
    desc: 'Fare confirmed before you ride. No surge, no hidden fees.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    title: 'Built for safety',
    desc: 'Verified drivers. Trip monitoring. 24/7 support.',
  },
];

const STEPS = [
  { title: 'Enter destination', description: 'See your exact fare and arrival time before you confirm.' },
  { title: 'Track your driver', description: 'Name, photo, plate number — visible from the moment of match.' },
  { title: 'Arrive and go', description: 'Payment completes automatically. No screens, no friction.' },
];

const SEATTLE_NEIGHBORHOODS = [
  { name: 'Downtown Seattle', tag: 'Launch' },
  { name: 'South Lake Union', tag: 'Launch' },
  { name: 'Capitol Hill', tag: 'Launch' },
  { name: 'SeaTac Airport', tag: 'SEA' },
  { name: 'Bellevue', tag: 'Eastside' },
  { name: 'University District', tag: 'Launch' },
];

const COMING_SOON_CITIES = [
  'Portland, OR', 'San Francisco, CA', 'Los Angeles, CA', 'Austin, TX', 'New York, NY',
];

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
    <div className="min-h-screen bg-white" style={{ overflowX: 'hidden' }}>

      {/* ═══ NAV ══════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled ? 'bg-white/80 backdrop-blur-2xl' : 'bg-transparent'
      }`}>
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 lg:px-10">
          {/* LEFT — Logo */}
          <Link href="/" className={`shrink-0 text-[17px] tracking-[0.01em] transition-colors duration-500 ${scrolled ? 'text-[#1d1d1f]' : 'text-white'}`}>
            <span className="font-semibold">TakeMe</span>
            <span className={`ml-[4px] font-light transition-colors duration-500 ${scrolled ? 'text-[#86868b]' : 'text-white/60'}`}>Mobility</span>
          </Link>

          {/* CENTER — Nav links */}
          <div className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map(({ label, href, badge }) => (
              <Link key={href} href={href} className={`flex items-center whitespace-nowrap text-[13px] font-medium transition-colors duration-200 ${scrolled ? 'text-[#86868b] hover:text-[#1d1d1f]' : 'text-white/60 hover:text-white'}`}>
                {label}
                {badge && (
                  <span style={{ background: '#1D6AE5', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 4, letterSpacing: '0.5px' }}>NEW</span>
                )}
              </Link>
            ))}
          </div>

          {/* RIGHT — Auth + CTA */}
          <div className="flex shrink-0 items-center gap-4">
            {loading ? (
              <div className={`h-4 w-4 animate-spin rounded-full border-[1.5px] ${scrolled ? 'border-[#d2d2d7] border-t-[#1d1d1f]' : 'border-white/30 border-t-white'}`} />
            ) : (
              <>
                <Link href={signInHref} className={`hidden text-[13px] font-medium transition-colors duration-200 sm:block ${scrolled ? 'text-[#86868b] hover:text-[#1d1d1f]' : 'text-white/60 hover:text-white'}`}>
                  Sign in
                </Link>
                <Link
                  href={ctaHref}
                  className="inline-flex h-9 items-center rounded-[999px] bg-[#1D6AE5] px-5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-[#1558C0]"
                >
                  Book a ride
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO — Cinematic WebGL ═════════════════════════════════════ */}
      <HeroCanvas />

      {/* ═══ ORIGINAL HERO (below cinematic) ══════════════════════════════ */}
      <section className="relative overflow-hidden bg-white pt-20 pb-12 md:pt-24 md:pb-16">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_480px] lg:gap-14">
            <div className="pt-2 lg:pt-4">
              <h2 className="text-[clamp(2.5rem,5.5vw,4.25rem)] font-bold leading-[1.08] tracking-[-0.035em] text-[#1d1d1f]">
                Book your ride now.
              </h2>
              <p className="mt-4 max-w-[420px] text-[19px] leading-[1.6] text-[#6e6e73]">
                Every ride, on your terms. Ready when you are.
              </p>
              <div className="mt-7 grid max-w-[420px] grid-cols-2 gap-4">
                <Link
                  href={ctaHref}
                  className="flex h-[52px] items-center justify-center rounded-[999px] bg-[#1D6AE5] text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#1558C0]"
                >
                  Book your ride
                </Link>
                <Link
                  href="#how-it-works"
                  className="flex h-[52px] items-center justify-center rounded-[999px] border border-[#d2d2d7] text-[15px] font-medium text-[#1d1d1f] transition-colors duration-200 hover:bg-[#f5f5f7]"
                >
                  See how it works
                </Link>
              </div>
            </div>
            <div>
              <HeroBookingWrapper ctaHref={ctaHref} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRUST LAYER ══════════════════════════════════════════════════ */}
      <section className="border-t border-[#f5f5f7] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-16 md:py-20 lg:px-10">
          <div className="grid gap-4 md:grid-cols-3">
            {TRUST_CARDS.map((card) => (
              <div key={card.title} className="flex items-start gap-4 rounded-2xl bg-[#f5f5f7] p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#6e6e73] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  {card.icon}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{card.title}</h3>
                  <p className="mt-1 text-[14px] leading-[1.6] text-[#6e6e73]">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═════════════════════════════════════════════════════ */}
      <section className="border-t border-[#f5f5f7] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { value: '<5s', label: 'matching' },
              { value: '100%', label: 'Electric' },
              { value: 'Real-time', label: 'tracking' },
              { value: 'AI-powered', label: 'safety' },
            ].map((stat, i) => (
              <div key={i} className={`flex flex-col items-center py-6 ${i > 0 ? 'border-l border-[#f5f5f7]' : ''}`}>
                <span className="text-[20px] font-bold tracking-[-0.02em] text-[#1d1d1f]">{stat.value}</span>
                <span className="mt-0.5 text-[13px] font-medium text-[#86868b]">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════════════════════ */}
      <section id="how-it-works" className="bg-[#f5f5f7]">
        <div
          ref={steps.ref}
          className={`mx-auto max-w-[1200px] px-6 py-28 md:py-36 lg:px-10 transition-all duration-[900ms] ease-out ${
            steps.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">How it works</p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Three steps. That's it.
          </h2>
          <div className="mt-16 grid gap-14 md:grid-cols-3 md:gap-10">
            {STEPS.map((step, i) => (
              <div key={i}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  <span className="text-[16px] font-bold tabular-nums text-[#1d1d1f]">{i + 1}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-[#1d1d1f]">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.7] text-[#6e6e73]">{step.description}</p>
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
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">Coverage</p>
              <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
                Available where<br />you need us.
              </h2>
            </div>
            <p className="max-w-sm text-[15px] leading-[1.7] text-[#6e6e73]">
              Live in Seattle. Expanding soon.
            </p>
          </div>

          {/* Seattle neighborhoods */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SEATTLE_NEIGHBORHOODS.map((n) => (
              <Link key={n.name} href="/cities" className="group flex items-center justify-between rounded-2xl border border-[#f5f5f7] bg-[#f5f5f7] px-5 py-5 transition-all duration-200 hover:border-[#d2d2d7]">
                <div>
                  <span className="text-[15px] font-semibold text-[#1d1d1f]">{n.name}</span>
                  <span className="ml-2 text-[11px] font-medium text-[#86868b]">{n.tag}</span>
                </div>
                <span className="text-[#86868b] transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
              </Link>
            ))}
          </div>

          {/* Coming soon */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Coming soon</span>
            <span className="h-3.5 w-[1px] bg-[#d2d2d7]" />
            {COMING_SOON_CITIES.map((city) => (
              <span key={city} className="rounded-full border border-[#d2d2d7] px-3.5 py-1.5 text-[13px] font-medium text-[#86868b]">
                {city}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STUDENTS ═══════════════════════════════════════════════════ */}
      <section className="border-t border-[#f5f5f7] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-16 md:py-20 lg:px-10">
          <Link
            href="/students"
            className="group flex flex-col items-start gap-6 rounded-2xl bg-[#f5f5f7] p-8 transition-all duration-200 hover:bg-[#f5f5f7] md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <svg className="h-6 w-6 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Student Plans</h3>
                <p className="mt-1 text-[15px] leading-[1.6] text-[#6e6e73]">
                  Up to 50% off every ride. From $9.90/mo.
                </p>
              </div>
            </div>
            <span className="text-[15px] font-medium text-[#1D6AE5] transition-transform duration-200 group-hover:translate-x-1">
              View plans &rarr;
            </span>
          </Link>
        </div>
      </section>

      {/* ═══ GET THE APP ═════════════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div
          ref={closing.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 transition-all duration-[1s] ease-out ${
            closing.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
              Get the app
            </p>

            <h2 className="mt-5 text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#1d1d1f]">
              Get the app.
            </h2>

            <p className="mt-5 text-[17px] leading-[1.65] text-[#6e6e73]">
              Available on iOS and Android.
            </p>

            {/* Store buttons — same grid as hero */}
            <div className="mx-auto mt-10 grid max-w-[420px] grid-cols-2 gap-4">
              <a href="#" className="flex h-[48px] items-center justify-center gap-2.5 rounded-xl bg-[#1d1d1f] transition-colors duration-200 hover:bg-[#333]">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.13 7.17 8.82 7.15C10.1 7.13 11.32 8.02 12.11 8.02C12.89 8.02 14.37 6.94 15.92 7.11C16.57 7.14 18.37 7.38 19.56 9.07C19.47 9.13 17.19 10.42 17.22 13.17C17.25 16.42 20.08 17.48 20.11 17.49C20.08 17.56 19.65 19.09 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-[9px] font-medium leading-none text-white/45">Download on the</span>
                  <span className="mt-0.5 text-[13px] font-semibold leading-tight text-white">App Store</span>
                </div>
              </a>
              <a href="#" className="flex h-[48px] items-center justify-center gap-2.5 rounded-xl bg-[#1d1d1f] transition-colors duration-200 hover:bg-[#333]">
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                  <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92z" fill="#4285F4" />
                  <path d="M16.657 8.893L5.536.497A1.005 1.005 0 014.39.56L14.727 10.9l1.93-2.007z" fill="#EA4335" />
                  <path d="M16.657 15.107l1.93 2.007 2.794-1.56a1 1 0 000-1.748l-2.795-1.56-1.93 2.008-.933.97.934-.117z" fill="#FBBC04" />
                  <path d="M4.39 23.44a1.005 1.005 0 001.146.063l11.12-8.396-1.929-2.007L4.39 23.44z" fill="#34A853" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-[9px] font-medium leading-none text-white/45">Get it on</span>
                  <span className="mt-0.5 text-[13px] font-semibold leading-tight text-white">Google Play</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer rendered by root layout */}
    </div>
  );
}
