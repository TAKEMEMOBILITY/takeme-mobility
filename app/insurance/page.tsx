'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';

// ── Shared nav links (mirror homepage) ──────────────────────────────────

const NAV_LINKS = [
  { label: 'TakeMe Fleet', href: '/fleet', badge: true },
  { label: 'Business', href: '/business', badge: false },
  { label: 'Insurance', href: '/insurance', badge: true },
  { label: 'TakeMe Connect', href: '/connect', badge: true },
  { label: 'Students Membership', href: '/students', badge: true },
  { label: 'Driver Hub', href: '/driver-hub', badge: true },
];

// ── Hooks (copied from homepage pattern) ────────────────────────────────

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

// ── Eyebrow tag (blue pill, matches homepage) ───────────────────────────

function EyebrowTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#1D6AE5]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D6AE5]">
      {children}
    </span>
  );
}

// ── Phone frame ─────────────────────────────────────────────────────────

function PhoneFrame({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <div
      className="relative transition-all duration-700 ease-out"
      style={{
        transform: active ? 'scale(1)' : 'scale(0.75)',
        filter: active ? 'none' : 'blur(2px)',
        opacity: active ? 1 : 0.5,
      }}
    >
      <div
        className="relative mx-auto overflow-hidden bg-[#1d1d1f] shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
        style={{
          width: 260,
          height: 540,
          borderRadius: 42,
          padding: 8,
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-white">
          {/* Notch */}
          <div
            className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-[#1d1d1f]"
            style={{ width: 90, height: 24 }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Phone screen contents ───────────────────────────────────────────────

function Screen1_Booking() {
  return (
    <div className="flex h-full flex-col bg-white p-4 pt-10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Where to?</p>
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-2 rounded-xl bg-[#f5f5f7] px-3 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#1D6AE5]" />
          <span className="text-[11px] font-medium text-[#1d1d1f]">Current location</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[#f5f5f7] px-3 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
          <span className="text-[11px] font-medium text-[#86868b]">Where to?</span>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5">
        {['Economy', 'Comfort', 'Premium'].map((t, i) => (
          <div
            key={t}
            className={`flex-1 rounded-lg px-1 py-2 text-center ${
              i === 1 ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'
            }`}
          >
            <p className="text-[10px]">{i === 0 ? '🚗' : i === 1 ? '🚙' : '🚘'}</p>
            <p className="mt-0.5 text-[9px] font-semibold">{t}</p>
            <p className={`text-[8px] tabular-nums ${i === 1 ? 'text-white/60' : 'text-[#86868b]'}`}>
              ${[8, 12, 18][i]}.50
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-[#f5f5f7] p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-[#86868b]">Fare</p>
        <p className="mt-0.5 text-[18px] font-bold text-[#1d1d1f]">$12.50</p>
      </div>

      <button className="mt-auto rounded-xl bg-[#1D6AE5] py-3 text-[11px] font-semibold text-white">
        Confirm ride
      </button>
    </div>
  );
}

function Screen2_SafetyScore() {
  return (
    <div className="flex h-full flex-col items-center bg-white p-4 pt-10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Safety Score</p>

      <div className="relative mt-4 h-[140px] w-[140px]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" stroke="#f5f5f7" strokeWidth="8" fill="none" />
          <circle
            cx="50" cy="50" r="42"
            stroke="#1D6AE5"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(87 / 100) * 264} 264`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[38px] font-bold leading-none text-[#1d1d1f]">87</span>
          <span className="text-[9px] font-medium text-[#86868b]">Excellent</span>
        </div>
      </div>

      <div className="mt-4 w-full space-y-1.5">
        {['Smooth braking', 'Steady speed', 'Low phone use'].map((f) => (
          <div key={f} className="flex items-center gap-2 rounded-lg bg-[#f5f5f7] px-2.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1D6AE5]" />
            <span className="text-[9px] font-medium text-[#1d1d1f]">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Screen3_Rate() {
  return (
    <div className="flex h-full flex-col bg-white p-4 pt-10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">This month</p>
      <p className="mt-1 text-[32px] font-bold leading-none text-[#1d1d1f]">$119</p>
      <p className="mt-0.5 text-[10px] font-medium text-[#1D6AE5]">↓ $30 saved</p>

      {/* Mini bar chart */}
      <div className="mt-4 flex h-[80px] items-end gap-1.5">
        {[62, 48, 70, 55, 40, 35, 30].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-[#1D6AE5]"
            style={{ height: `${h}%`, opacity: 0.4 + i * 0.1 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[8px] text-[#86868b]">
        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-[#f5f5f7] p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-[#86868b]">Next bill</p>
        <p className="mt-0.5 text-[14px] font-bold text-[#1d1d1f]">$119.00</p>
        <p className="text-[9px] text-[#86868b]">Aug 1</p>
      </div>
    </div>
  );
}

function Screen4_Claim() {
  return (
    <div className="flex h-full flex-col bg-white p-4 pt-10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">New claim</p>
      <h3 className="mt-1 text-[14px] font-bold text-[#1d1d1f]">File in 60 seconds</h3>

      <div className="mt-3 space-y-2">
        <div className="rounded-xl border border-[#d2d2d7] px-3 py-2.5">
          <p className="text-[8px] text-[#86868b]">Date of incident</p>
          <p className="text-[11px] font-semibold text-[#1d1d1f]">Jul 28, 2025</p>
        </div>
        <div className="rounded-xl border border-[#d2d2d7] px-3 py-2.5">
          <p className="text-[8px] text-[#86868b]">Type</p>
          <p className="text-[11px] font-semibold text-[#1d1d1f]">Minor collision</p>
        </div>
        <div className="rounded-xl border border-[#d2d2d7] px-3 py-2.5">
          <p className="text-[8px] text-[#86868b]">Photos</p>
          <p className="text-[11px] font-semibold text-[#1D6AE5]">3 uploaded ✓</p>
        </div>
      </div>

      <button className="mt-auto rounded-xl bg-[#1D6AE5] py-3 text-[11px] font-semibold text-white">
        Submit claim
      </button>
    </div>
  );
}

const PHONE_SCREENS = [
  { component: <Screen1_Booking />, label: 'Book a ride' },
  { component: <Screen2_SafetyScore />, label: 'Safety Score' },
  { component: <Screen3_Rate />, label: 'Monthly rate' },
  { component: <Screen4_Claim />, label: 'Easy claims' },
];

// ── Animated score circle (SVG, 0 → 87 on scroll into view) ─────────────

function AnimatedScore() {
  const { ref, visible } = useReveal(0.3);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    const duration = 1800;
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * 87));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  const R = 90;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (value / 100) * CIRC;

  return (
    <div ref={ref} className="relative mx-auto h-[240px] w-[240px]">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={R} stroke="#e5e5ea" strokeWidth="12" fill="none" />
        <circle
          cx="100" cy="100" r={R}
          stroke="#1D6AE5"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[72px] font-bold leading-none text-[#1d1d1f]">{value}</span>
        <span className="mt-1 text-[13px] font-medium text-[#86868b]">Your safety score</span>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function InsurancePage() {
  const { user, loading } = useAuth();
  const scrolled = useScrolled();

  const hero = useReveal(0.1);
  const howItWorks = useReveal(0.15);
  const pricing = useReveal(0.15);
  const closing = useReveal(0.2);

  const ctaHref = user ? '/dashboard' : '/auth/signup';
  const signInHref = user ? '/dashboard' : '/auth/login';

  // Phone carousel auto-rotate
  const [phoneIdx, setPhoneIdx] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      setPhoneIdx((i) => (i + 1) % PHONE_SCREENS.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // Pricing tiers
  const tiers = [
    {
      name: 'Basic',
      price: 89,
      highlighted: false,
      features: ['Liability coverage', 'Accident assistance', 'Real-time safety score', 'Mobile claims filing'],
    },
    {
      name: 'Plus',
      price: 149,
      highlighted: true,
      features: ['Everything in Basic', 'Collision coverage', 'Roadside assistance', 'Score-based discounts', 'Priority support'],
    },
    {
      name: 'Premium',
      price: 199,
      highlighted: false,
      features: ['Everything in Plus', 'Full comprehensive', 'Rental car coverage', 'Zero-deductible perks', 'Dedicated agent'],
    },
  ];

  return (
    <div className="min-h-screen bg-white" style={{ overflowX: 'hidden' }}>

      {/* ═══ NAV (mirror homepage) ════════════════════════════════════════ */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled ? 'bg-white/80 backdrop-blur-2xl' : 'bg-white'
      }`}>
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="shrink-0 text-[17px] tracking-[0.01em] text-[#1d1d1f]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[4px] font-light text-[#86868b]">Mobility</span>
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map(({ label, href, badge }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center whitespace-nowrap text-[13px] font-medium transition-colors duration-200 ${
                  href === '/insurance' ? 'text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                {label}
                {badge && (
                  <span style={{ background: '#1D6AE5', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 4, letterSpacing: '0.5px' }}>NEW</span>
                )}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-4">
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-[#d2d2d7] border-t-[#1d1d1f]" />
            ) : (
              <>
                <Link href={signInHref} className="hidden text-[13px] font-medium text-[#86868b] transition-colors duration-200 hover:text-[#1d1d1f] sm:block">
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

      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="bg-white pt-28 pb-16 md:pt-32 md:pb-20">
        <div
          ref={hero.ref}
          className="mx-auto max-w-[1200px] px-6 lg:px-10"
          style={{
            opacity: hero.visible ? 1 : 0,
            transform: hero.visible ? 'translateY(0)' : 'translateY(32px)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
          }}
        >
          <div className="mx-auto max-w-[820px] text-center">
            <EyebrowTag>New · TakeMe Insurance</EyebrowTag>

            <h1
              className="mt-6 text-[#1d1d1f]"
              style={{
                fontFamily: 'var(--font-dm-serif), Georgia, serif',
                fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
              }}
            >
              Insurance You Control.
            </h1>

            <p className="mx-auto mt-5 max-w-[560px] text-[19px] leading-[1.6] text-[#6e6e73]">
              Every safe ride lowers your rate.
              <br />
              Drive well. Pay less.
            </p>

            <div className="mx-auto mt-8 flex max-w-[420px] flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={ctaHref}
                className="flex h-[52px] items-center justify-center rounded-[999px] bg-[#1D6AE5] px-8 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#1558C0]"
              >
                Get a quote
              </Link>
              <Link
                href="#how-it-works"
                className="flex h-[52px] items-center justify-center rounded-[999px] border border-[#d2d2d7] px-8 text-[15px] font-medium text-[#1d1d1f] transition-colors duration-200 hover:bg-[#f5f5f7]"
              >
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PHONE CAROUSEL ═══════════════════════════════════════════════ */}
      <section className="bg-white pb-20 md:pb-28">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10">

          {/* Phones row */}
          <div className="flex items-center justify-center gap-6 md:gap-8">
            {PHONE_SCREENS.map((screen, i) => (
              <div
                key={i}
                className={`${i === phoneIdx ? 'block' : 'hidden md:block'}`}
              >
                <PhoneFrame active={i === phoneIdx}>
                  {screen.component}
                </PhoneFrame>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div className="mt-10 flex justify-center gap-2">
            {PHONE_SCREENS.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhoneIdx(i)}
                aria-label={`Show screen ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === phoneIdx ? 'w-8 bg-[#1D6AE5]' : 'w-2 bg-[#d2d2d7]'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS / SAFETY SCORE ══════════════════════════════════ */}
      <section id="how-it-works" className="bg-[#f5f5f7]">
        <div
          ref={howItWorks.ref}
          className="mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10"
          style={{
            opacity: howItWorks.visible ? 1 : 0,
            transform: howItWorks.visible ? 'translateY(0)' : 'translateY(32px)',
            transition: 'opacity 0.9s ease, transform 0.9s ease',
          }}
        >
          <div className="text-center">
            <EyebrowTag>How it works</EyebrowTag>
            <h2
              className="mt-5 text-[#1d1d1f]"
              style={{
                fontFamily: 'var(--font-dm-serif), Georgia, serif',
                fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
              }}
            >
              Your driving is your rate.
            </h2>
            <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.65] text-[#6e6e73]">
              Every trip you take is analyzed. Safe patterns move your score up,
              and your monthly premium down.
            </p>
          </div>

          {/* Score gauge */}
          <div className="mt-16 flex justify-center">
            <AnimatedScore />
          </div>

          {/* Factor cards */}
          <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                  </svg>
                ),
                title: 'Smooth braking',
                desc: 'Gentle stops signal predictable, attentive driving.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 9 18l11.25-11.25" />
                  </svg>
                ),
                title: 'Steady speed',
                desc: 'Consistent velocity is safer and more fuel-efficient.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                ),
                title: 'Low phone use',
                desc: 'Eyes on the road means more reward, less risk.',
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                ),
                title: 'Time of day',
                desc: 'Daytime trips carry less risk than late-night travel.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="flex items-start gap-4 rounded-2xl bg-white p-6"
                style={{ borderRadius: 14 }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1D6AE5]/10 text-[#1D6AE5]">
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

      {/* ═══ PRICING ══════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={pricing.ref}
          className="mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10"
          style={{
            opacity: pricing.visible ? 1 : 0,
            transform: pricing.visible ? 'translateY(0)' : 'translateY(32px)',
            transition: 'opacity 0.9s ease, transform 0.9s ease',
          }}
        >
          <div className="text-center">
            <EyebrowTag>Plans</EyebrowTag>
            <h2
              className="mt-5 text-[#1d1d1f]"
              style={{
                fontFamily: 'var(--font-dm-serif), Georgia, serif',
                fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
              }}
            >
              Pick a plan. Pay less for driving well.
            </h2>

            {/* Discount badge */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1D6AE5]/10 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-[#1D6AE5]" />
              <span className="text-[13px] font-semibold text-[#1D6AE5]">
                Score above 90 = 20% discount
              </span>
            </div>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col bg-white p-8 transition-all duration-300 ${
                  tier.highlighted
                    ? 'border-2 border-[#1D6AE5] shadow-[0_20px_60px_rgba(29,106,229,0.15)]'
                    : 'border border-[#f5f5f7]'
                }`}
                style={{ borderRadius: 14 }}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1D6AE5] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Most popular
                  </span>
                )}

                <h3 className="text-[15px] font-semibold uppercase tracking-wider text-[#86868b]">{tier.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-[48px] font-bold leading-none tracking-[-0.03em] text-[#1d1d1f]">${tier.price}</span>
                  <span className="text-[15px] font-medium text-[#86868b]">/mo</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#1D6AE5]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      <span className="text-[14px] leading-[1.55] text-[#1d1d1f]">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={ctaHref}
                  className={`mt-8 flex h-[48px] items-center justify-center rounded-[999px] text-[14px] font-medium transition-colors duration-200 ${
                    tier.highlighted
                      ? 'bg-[#1D6AE5] text-white hover:bg-[#1558C0]'
                      : 'border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  Get {tier.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ BOTTOM CTA — black ═══════════════════════════════════════════ */}
      <section className="bg-[#0A0A0A]">
        <div
          ref={closing.ref}
          className="mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10"
          style={{
            opacity: closing.visible ? 1 : 0,
            transform: closing.visible ? 'translateY(0)' : 'translateY(32px)',
            transition: 'opacity 0.9s ease, transform 0.9s ease',
          }}
        >
          <div className="mx-auto max-w-xl text-center">
            <h2
              className="text-white"
              style={{
                fontFamily: 'var(--font-dm-serif), Georgia, serif',
                fontSize: 'clamp(2rem, 5vw, 3.25rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
              }}
            >
              Drive well. Pay less.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-[#86868b]">
              Get covered in minutes. Cancel anytime.
            </p>

            <Link
              href={ctaHref}
              className="mt-10 inline-flex h-[54px] items-center justify-center rounded-[999px] bg-white px-9 text-[15px] font-semibold text-[#0A0A0A] transition-colors duration-200 hover:bg-[#f5f5f7]"
            >
              Get your quote
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
