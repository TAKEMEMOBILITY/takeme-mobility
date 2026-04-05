'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

// ── Hooks ────────────────────────────────────────────────────────────────

function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    let last = window.scrollY > threshold;
    setScrolled(last);
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > threshold;
        if (next !== last) {
          last = next;
          setScrolled(next);
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [threshold]);
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

const NEIGHBORHOODS = [
  'Downtown / Pioneer Square',
  'Capitol Hill / First Hill',
  'South Lake Union / Fremont',
  'University District / Wallingford',
  'Ballard / Greenwood',
  'Columbia City / Beacon Hill',
  'West Seattle',
  'SeaTac Airport (SEA)',
  'Bellevue / Eastside',
  'Kirkland / Redmond',
];

const KEY_ROUTES = [
  { from: 'SeaTac Airport', to: 'Downtown', time: '~25 min', note: 'Flat-rate pricing' },
  { from: 'Capitol Hill', to: 'South Lake Union', time: '~8 min', note: null },
  { from: 'University District', to: 'Pioneer Square', time: '~15 min', note: null },
  { from: 'Bellevue', to: 'Downtown Seattle', time: '~20 min', note: null },
];

const INCENTIVES = [
  { amount: 'Up to $9,000', title: 'Federal EV Tax Credit', desc: 'Federal tax credit for qualifying electric vehicles under IRC 30D. Applied directly to your tax liability.' },
  { amount: 'Up to $7,500', title: 'WA Sales Tax Exemption', desc: 'Washington State sales tax exemption on new electric vehicles priced under $45,000.' },
  { amount: '$112M WAZIP Fund', title: 'Fleet Electrification', desc: 'Washington Zero Emission Incentive Program providing direct grants for fleet electrification and EV infrastructure.' },
  { amount: 'HOV Lane Access', title: 'Priority Lane Access', desc: 'Electric vehicles can use Washington HOV lanes regardless of occupancy, cutting commute times significantly.' },
  { amount: 'Reduced Registration', title: 'Lower Annual Fees', desc: 'Lower annual registration fees for battery electric vehicles compared to internal combustion equivalents.' },
  { amount: 'Free Charging', title: 'Public Charging Perks', desc: 'Many Seattle parking garages offer complimentary Level 2 EV charging to registered electric vehicle owners.' },
];

const CHARGING_STATS = [
  { value: '2,500+', label: 'Public charging ports in King County' },
  { value: '70%+', label: 'Hydroelectric power grid' },
  { value: '300+', label: 'DC fast chargers in metro area' },
];

const EXPANSION_CITIES = [
  { quarter: '2026 Q3', city: 'Portland', state: 'OR', tagline: 'Pacific Northwest corridor' },
  { quarter: '2026 Q4', city: 'San Francisco', state: 'CA', tagline: 'The EV capital' },
  { quarter: '2027 Q1', city: 'Los Angeles', state: 'CA', tagline: "America's largest rideshare market" },
  { quarter: '2027 Q2', city: 'Austin', state: 'TX', tagline: 'Tech hub, EV-friendly policies' },
  { quarter: '2027 Q3', city: 'New York', state: 'NY', tagline: 'The world stage' },
  { quarter: '2027 Q4', city: 'Miami', state: 'FL', tagline: 'Southeast gateway' },
];

const PROMISES = [
  {
    title: '100% electric fleet in every market',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
  },
  {
    title: 'Full driver verification in every city',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    title: 'Transparent, locked pricing everywhere',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    title: '24/7 safety monitoring, globally',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
];

// ── Page ──────────────────────────────────────────────────────────────────

export default function CitiesPage() {
  const scrolled = useScrolled();
  const seattle = useReveal(0.12);
  const incentives = useReveal(0.12);
  const charging = useReveal(0.12);
  const expansion = useReveal(0.12);
  const promise = useReveal(0.12);
  const cta = useReveal(0.15);

  return (
    <div className="min-h-screen bg-white">

      {/* ═══ NAV ══════════════════════════════════════════════════════════ */}
      <nav
        className={`fixed top-0 z-50 w-full ${
          scrolled ? 'bg-white/85 backdrop-blur-lg' : 'bg-transparent'
        }`}
        style={{ willChange: 'transform', transform: 'translateZ(0)' }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] tracking-[0.01em] text-[#1d1d1f]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#86868b]">Mobility</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[14px] font-medium text-[#86868b] transition-colors duration-200 hover:text-[#1d1d1f]">
              Home
            </Link>
            <Link href="/technology" className="text-[14px] font-medium text-[#86868b] transition-colors duration-200 hover:text-[#1d1d1f]">
              Technology
            </Link>
            <Link href="/safety" className="text-[14px] font-medium text-[#86868b] transition-colors duration-200 hover:text-[#1d1d1f]">
              Safety
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="bg-white pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Cities
          </p>
          <h1 className="mt-5 text-[clamp(2.5rem,5.5vw,4rem)] font-bold leading-[1.08] tracking-[-0.035em] text-[#1d1d1f]">
            Starting in Seattle.<br />Scaling everywhere.
          </h1>
          <p className="mt-6 max-w-[620px] text-[19px] leading-[1.6] text-[#6e6e73]">
            TakeMe launches in the Pacific Northwest — one of America's most EV-ready metropolitan areas. Every city we enter gets the same premium, all-electric experience from day one.
          </p>
        </div>
      </section>

      {/* ═══ SEATTLE LAUNCH CITY ══════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div
          ref={seattle.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 transition-all duration-[900ms] ease-out ${
            seattle.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Launch City
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Seattle, Washington
          </h2>
          <p className="mt-2 text-[19px] font-medium text-[#1D6AE5]">
            America's most EV-ready city.
          </p>
          <p className="mt-5 max-w-[680px] text-[17px] leading-[1.6] text-[#6e6e73]">
            Seattle is the ideal launch market. Washington State leads the nation in EV adoption, with over 130,000 registered electric vehicles. The city's compact urban core, progressive environmental policies, and tech-forward population make it the perfect proving ground for all-electric rideshare.
          </p>

          {/* Neighborhoods */}
          <div className="mt-16">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">
              Neighborhoods Served
            </h3>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {NEIGHBORHOODS.map((name) => (
                <div
                  key={name}
                  className="rounded-2xl border border-[#d2d2d7] bg-white px-4 py-4 text-center"
                >
                  <span className="text-[14px] font-medium text-[#1d1d1f]">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Routes */}
          <div className="mt-16">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">
              Key Routes
            </h3>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {KEY_ROUTES.map((route) => (
                <div
                  key={route.from + route.to}
                  className="flex items-center justify-between rounded-2xl bg-white px-6 py-5 border border-[#d2d2d7]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-medium text-[#1d1d1f]">{route.from}</span>
                    <svg className="h-4 w-4 shrink-0 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                    <span className="text-[15px] font-medium text-[#1d1d1f]">{route.to}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-semibold tabular-nums text-[#1d1d1f]">{route.time}</span>
                    {route.note && (
                      <span className="hidden rounded-full bg-[#1D6AE5]/10 px-3 py-1 text-[12px] font-medium text-[#1D6AE5] sm:inline-block">
                        {route.note}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ EV INCENTIVES ════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={incentives.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 transition-all duration-[900ms] ease-out ${
            incentives.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            EV Incentives
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Washington is investing in electric.
          </h2>
          <p className="mt-5 max-w-[680px] text-[17px] leading-[1.6] text-[#6e6e73]">
            Washington State has committed over $112 million through the Washington Zero Emission Incentive Program (WAZIP) to accelerate EV adoption. For TakeMe drivers, this means significant financial advantages.
          </p>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INCENTIVES.map((item) => (
              <div
                key={item.title}
                className="group rounded-2xl border border-[#f5f5f7] bg-[#f5f5f7] p-6 transition-all duration-200 hover:border-[#d2d2d7] hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
              >
                <p className="text-[clamp(1.25rem,2.5vw,1.5rem)] font-bold tracking-[-0.02em] text-[#1D6AE5]">
                  {item.amount}
                </p>
                <h3 className="mt-2 text-[15px] font-semibold text-[#1d1d1f]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#6e6e73]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CHARGING INFRASTRUCTURE ═════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div
          ref={charging.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 transition-all duration-[900ms] ease-out ${
            charging.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Charging Network
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Powered by the Pacific Northwest.
          </h2>
          <p className="mt-5 max-w-[680px] text-[17px] leading-[1.6] text-[#6e6e73]">
            Seattle's charging infrastructure is among the densest in the United States. Over 2,500 public charging ports within King County, with the number growing monthly. Washington's grid runs 70%+ on hydroelectric power — meaning TakeMe rides are powered by some of the cleanest electricity in the country.
          </p>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {CHARGING_STATS.map((stat) => (
              <div
                key={stat.value}
                className="rounded-2xl bg-white px-6 py-8 text-center border border-[#d2d2d7]"
              >
                <p className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.03em] text-[#1d1d1f]">
                  {stat.value}
                </p>
                <p className="mt-2 text-[14px] leading-[1.5] text-[#6e6e73]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ EXPANSION ROADMAP ════════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={expansion.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 transition-all duration-[900ms] ease-out ${
            expansion.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Expansion
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            The roadmap.
          </h2>
          <p className="mt-5 max-w-[680px] text-[17px] leading-[1.6] text-[#6e6e73]">
            Seattle is the beginning. TakeMe is building toward nationwide coverage, one city at a time. Each launch follows the same playbook: verify the charging infrastructure, recruit and verify local drivers, and open at full quality from day one.
          </p>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXPANSION_CITIES.map((item) => (
              <div
                key={item.city}
                className="group relative rounded-2xl border border-[#f5f5f7] bg-[#f5f5f7] p-6 transition-all duration-200 hover:border-[#d2d2d7]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[19px] font-semibold text-[#1d1d1f]">
                      {item.city}, {item.state}
                    </h3>
                    <p className="mt-1 text-[14px] text-[#6e6e73]">{item.tagline}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#f5f5f7] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#86868b]">
                    Coming soon
                  </span>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                  <span className="text-[13px] font-medium text-[#86868b]">{item.quarter}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ OUR PROMISE ══════════════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div
          ref={promise.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 transition-all duration-[900ms] ease-out ${
            promise.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            Our Promise
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            One standard. Every city.
          </h2>
          <p className="mt-5 max-w-[680px] text-[17px] leading-[1.6] text-[#6e6e73]">
            Whether you're in Seattle or San Francisco, the experience is identical. Same app, same safety standards, same all-electric fleet, same transparent pricing. No city gets a lesser version. No market gets shortcuts.
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-2xl bg-white p-6 border border-[#d2d2d7]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f7] text-[#1d1d1f]">
                  {item.icon}
                </div>
                <p className="text-[15px] font-medium leading-[1.5] text-[#1d1d1f]">
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ══════════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div
          ref={cta.ref}
          className={`mx-auto max-w-[1200px] px-6 py-24 md:py-32 lg:px-10 transition-all duration-[1s] ease-out ${
            cta.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
              Ready to ride in Seattle?
            </h2>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex h-[52px] items-center rounded-[999px] bg-[#1D6AE5] px-8 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#005bb5]"
              >
                Book a ride
              </Link>
              <Link
                href="/driver/apply"
                className="inline-flex h-[52px] items-center rounded-[999px] border border-[#d2d2d7] px-8 text-[15px] font-medium text-[#1d1d1f] transition-colors duration-200 hover:bg-[#f5f5f7]"
              >
                Become a driver
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer rendered by root layout */}
    </div>
  );
}
