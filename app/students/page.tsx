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

const PLANS = [
  {
    name: 'Student Basic',
    price: '$9.90',
    period: '/mo',
    features: ['20% off all rides', 'Priority driver matching', 'Student support line', 'Cancel anytime'],
    accent: false,
  },
  {
    name: 'Student Plus',
    price: '$19.90',
    period: '/mo',
    features: ['50% off all rides', '10 free rides per month', 'Priority driver matching', 'Student support line', 'Cancel anytime'],
    accent: true,
  },
  {
    name: 'Student Pro',
    price: '$29.90',
    period: '/mo',
    features: ['50% off all rides', 'Unlimited rides', 'SIM card included', 'Priority driver matching', 'Student support line', 'Cancel anytime'],
    accent: false,
  },
];

const PARTNER_UNIVERSITIES = [
  { name: 'University of Washington', abbr: 'UW', color: '#4B2E83' },
  { name: 'Seattle University', abbr: 'SU', color: '#AA0000' },
  { name: 'Seattle Pacific University', abbr: 'SPU', color: '#002855' },
];

// ── Page ─────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const scrolled = useScrolled();
  const pricing = useReveal(0.15);
  const universities = useReveal(0.15);
  const ctaSection = useReveal(0.2);
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = () => {
    if (!email.endsWith('.edu')) {
      setError('Please enter a valid .edu email address');
      setVerified(false);
      return;
    }
    setError('');
    setVerified(true);
  };

  return (
    <div className="min-h-screen bg-white">

      {/* ═══ NAV ══════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled ? 'bg-white/80 backdrop-blur-2xl' : 'bg-transparent'
      }`}>
        <div className="mx-auto flex h-12 max-w-[1200px] items-center justify-between px-6 lg:px-10">
          <Link href="/" className="text-[15px] tracking-[0.01em] text-[#1D1D1F]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[3px] font-light text-[#8E8E93]">Mobility</span>
          </Link>
          <Link
            href="/"
            className="text-[13px] font-medium text-[#6E6E73] transition-colors duration-200 hover:text-[#1D1D1F]"
          >
            &larr; Back
          </Link>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#F5F5F7] pt-20">
        <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E8E8ED] bg-white px-4 py-1.5 text-[13px] font-medium text-[#6E6E73]">
              <svg className="h-4 w-4 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
              </svg>
              Student Program
            </div>

            <h1 className="mt-8 text-[clamp(2.5rem,6vw,4rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-[#1D1D1F]">
              Ride More. Pay Less.
            </h1>

            <p className="mt-5 text-[clamp(1.1rem,2.5vw,1.35rem)] leading-[1.5] text-[#86868B]">
              Student Membership — 50% off every ride.
            </p>

            {/* .edu verification badge */}
            <div className="mx-auto mt-10 max-w-md">
              <div className="rounded-2xl border border-[#E8E8ED] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F7]">
                    {verified ? (
                      <svg className="h-5 w-5 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-[#A1A1A6]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#1D1D1F]">
                      {verified ? 'Email verified!' : 'Verify your student status'}
                    </p>
                    <p className="text-[12px] text-[#A1A1A6]">
                      {verified ? 'You\'re eligible for student pricing' : 'Enter your .edu email to get started'}
                    </p>
                  </div>
                </div>
                {!verified && (
                  <div className="mt-4">
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        placeholder="you@university.edu"
                        className="flex-1 rounded-xl border border-[#E8E8ED] bg-[#FAFAFA] px-4 py-2.5 text-[14px] text-[#1D1D1F] placeholder-[#C7C7CC] outline-none transition-colors duration-200 focus:border-[#0071E3] focus:bg-white"
                      />
                      <button
                        onClick={handleVerify}
                        className="shrink-0 rounded-xl bg-[#1D1D1F] px-5 py-2.5 text-[14px] font-medium text-white transition-colors duration-200 hover:bg-[#2C2C2E]"
                      >
                        Verify
                      </button>
                    </div>
                    {error && (
                      <p className="mt-2 text-[13px] text-[#FF3B30]">{error}</p>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-3 text-[12px] text-[#C7C7CC]">
                Verified by SheerID. We never share your email.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ══════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={pricing.ref}
          className={`mx-auto max-w-[1200px] px-6 py-28 md:py-36 lg:px-10 transition-all duration-[900ms] ease-out ${
            pricing.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">Pricing</p>
            <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1D1D1F]">
              Plans that move with you.
            </h2>
            <p className="mt-4 text-[17px] leading-[1.65] text-[#86868B]">
              Every plan includes verified student status and instant activation.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-200 ${
                  plan.accent
                    ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]'
                    : 'border-[#E8E8ED] bg-[#FAFAFA] text-[#1D1D1F]'
                }`}
              >
                {plan.accent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0071E3] px-4 py-1 text-[12px] font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[36px] font-bold tracking-[-0.03em]">{plan.price}</span>
                  <span className={`text-[15px] ${plan.accent ? 'text-white/60' : 'text-[#A1A1A6]'}`}>{plan.period}</span>
                </div>
                <div className="mt-8 flex flex-1 flex-col gap-3.5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3">
                      <svg className={`h-4 w-4 shrink-0 ${plan.accent ? 'text-[#34C759]' : 'text-[#34C759]'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      <span className={`text-[14px] ${plan.accent ? 'text-white/80' : 'text-[#6E6E73]'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
                <button
                  className={`mt-8 flex h-[48px] w-full items-center justify-center rounded-[999px] text-[15px] font-medium transition-colors duration-200 ${
                    plan.accent
                      ? 'bg-white text-[#1D1D1F] hover:bg-white/90'
                      : 'bg-[#1D1D1F] text-white hover:bg-[#2C2C2E]'
                  }`}
                >
                  Get {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PARTNER UNIVERSITIES ═════════════════════════════════════════ */}
      <section className="bg-[#F5F5F7]">
        <div
          ref={universities.ref}
          className={`mx-auto max-w-[1200px] px-6 py-28 md:py-36 lg:px-10 transition-all duration-[900ms] ease-out ${
            universities.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">Partner universities</p>
            <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1D1D1F]">
              Trusted by top Seattle campuses.
            </h2>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {PARTNER_UNIVERSITIES.map((uni) => (
              <div
                key={uni.name}
                className="flex flex-col items-center gap-4 rounded-2xl border border-[#E8E8ED] bg-white p-8 text-center transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl text-[20px] font-bold text-white"
                  style={{ backgroundColor: uni.color }}
                >
                  {uni.abbr}
                </div>
                <h3 className="text-[15px] font-semibold text-[#1D1D1F]">{uni.name}</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E8ED] px-3 py-1 text-[12px] font-medium text-[#34C759]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                  Active partner
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ══════════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={ctaSection.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 transition-all duration-[1s] ease-out ${
            ctaSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F]">
              Start saving today.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-[#86868B]">
              Verify your .edu email and unlock student pricing in seconds.
            </p>
            <div className="mt-10">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex h-[52px] items-center rounded-[999px] bg-[#1D1D1F] px-8 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#2C2C2E]"
              >
                Verify with .edu email
              </button>
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
                Premium global transportation.<br />One standard, everywhere.
              </p>
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
