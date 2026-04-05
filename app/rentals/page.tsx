'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FLEET,
  BRANDS,
  CATEGORIES,
  filterFleet,
  type Vehicle,
  type FleetFilters,
} from '@/lib/fleet-data';

// ═══════════════════════════════════════════════════════════════════════════
// TakeMe Fleet — Premium EV Marketplace
// "Vehicles are earning assets."
// ═══════════════════════════════════════════════════════════════════════════

const PICKUP_LOCATIONS = ['Downtown Seattle', 'South Lake Union', 'Capitol Hill', 'SeaTac Airport', 'Bellevue', 'University District'];

const FAQ_ITEMS = [
  { q: 'How does charging work?', a: 'Every rental includes a charging card for all major networks. Charging costs are included. Return with at least 80% charge.', open: true },
  { q: 'Is insurance included?', a: 'Basic liability is included. Add comprehensive coverage for $19/day — collision, personal effects, and roadside assistance.', open: true },
  { q: 'What happens if the battery runs low?', a: 'Every vehicle has real-time range estimation and charger navigation. If you run out, 24/7 roadside sends a mobile charger at no cost.' },
  { q: 'Can owners choose who rents their vehicle?', a: 'Owners set eligibility requirements — age, driver score, rental history. TakeMe enforces these automatically.' },
  { q: 'How do payouts work?', a: 'Owners receive 80% of rental revenue. Payouts process weekly for completed, undisputed bookings.' },
  { q: 'How fast can drivers start earning?', a: 'If your profile is verified, you can rent and go online within minutes of booking confirmation.' },
];

function useScrolled(t = 10) {
  const [s, set] = useState(false);
  useEffect(() => {
    let ticking = false;
    let last = window.scrollY > t;
    set(last);
    const h = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > t;
        if (next !== last) { last = next; set(next); }
        ticking = false;
      });
    };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, [t]);
  return s;
}
function useReveal(t = 0.18) { const ref = useRef<HTMLDivElement>(null); const [v, set] = useState(false); useEffect(() => { const el = ref.current; if (!el) return; const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) set(true); }, { threshold: t }); o.observe(el); return () => o.disconnect(); }, [t]); return { ref, visible: v }; }

const usd = (n: number) => `$${n.toLocaleString()}`;

// Estimated driver daily gross (ride earnings)
const DRIVER_DAILY_GROSS = 210;
const OWNER_COMMISSION = 0.80; // 80% to owner
const TAKEME_FEE = 0.20;

const CATEGORY_COLORS: Record<string, string> = {
  sedan: 'bg-blue-50 text-blue-600', suv: 'bg-green-50 text-green-600',
  truck: 'bg-amber-50 text-amber-700', luxury: 'bg-purple-50 text-purple-600',
  performance: 'bg-red-50 text-red-600',
};

const PAGE_SIZE = 12;

// ── Page ─────────────────────────────────────────────────────────────────

export default function FleetPage() {
  const scrolled = useScrolled();
  const howItWorks = useReveal(0.15);
  const earnings = useReveal(0.15);
  const ownerSection = useReveal(0.15);
  const trustSection = useReveal(0.15);

  // Filters
  const [filters, setFilters] = useState<FleetFilters>({});
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => filterFleet(filters), [filters]);
  const shown = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = shown.length < filtered.length;

  // Booking modal
  const [bookingVehicle, setBookingVehicle] = useState<Vehicle | null>(null);

  // ROI calculator
  const [roiDays, setRoiDays] = useState(20);

  // FAQ
  const [openFaq, setOpenFaq] = useState<Set<number>>(new Set([0, 1]));

  // Hero earning form
  const [heroVehicleType, setHeroVehicleType] = useState('sedan');
  const [heroCommitment, setHeroCommitment] = useState<'weekly' | 'monthly'>('monthly');
  const heroVehicle = FLEET.find(v => v.category === heroVehicleType) ?? FLEET[0];
  const heroRental = heroCommitment === 'monthly' ? Math.round(heroVehicle.weeklyRate / 7 * 0.85) : Math.round(heroVehicle.weeklyRate / 7); // monthly gets ~15% better effective rate
  const heroDriverNet = DRIVER_DAILY_GROSS - heroRental;
  const heroOwnerEarnings = Math.round(heroRental * OWNER_COMMISSION);
  const heroTakemeFee = Math.round(heroRental * TAKEME_FEE);
  const commitmentHint = heroCommitment === 'monthly' ? 'Best for consistent income' : 'Flexible, lower commitment';

  return (
    <div className="min-h-screen bg-white">

      {/* ═══ NAV ═══════════════════════════════════════════════════════════ */}
      <nav
        className={`fixed top-0 z-50 w-full ${scrolled ? 'bg-white/85 backdrop-blur-lg shadow-[0_1px_0_rgba(0,0,0,0.04)]' : 'bg-transparent'}`}
        style={{ willChange: 'transform', transform: 'translateZ(0)' }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] text-[#1d1d1f]">
            <span className="font-semibold">TakeMe</span><span className="ml-1 font-light text-[#86868b]">Fleet</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/fleet/apply" className="text-[14px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">List your EV</Link>
            <Link href="/" className="text-[14px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">Home</Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#f5f5f7] pt-24 pb-16 md:pt-28 md:pb-20">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_440px] lg:gap-16">
            {/* Left */}
            <div className="pt-2 lg:pt-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#1D6AE5]">TakeMe Fleet</p>
              <h1 className="mt-4 text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.08] tracking-[-0.035em] text-[#1d1d1f]">
                Turn vehicles into
                <br />income infrastructure.
              </h1>
              <p className="mt-4 max-w-md text-[18px] leading-[1.6] text-[#6e6e73]">
                EV owners deploy assets. Drivers generate revenue. TakeMe runs the system.
              </p>

              {/* Animated hero metrics */}
              <div className="mt-6 flex flex-wrap items-center gap-5 text-[14px]">
                <span className="tabular-nums font-semibold text-[#1d1d1f]">{usd(heroDriverNet)}/day <span className="font-normal text-[#86868b]">driver net</span></span>
                <span className="h-4 w-px bg-[#d2d2d7]" />
                <span className="tabular-nums font-semibold text-[#1d1d1f]">$1,424/mo <span className="font-normal text-[#86868b]">owner payout</span></span>
                <span className="h-4 w-px bg-[#d2d2d7]" />
                <span className="tabular-nums font-semibold text-[#1d1d1f]">{FLEET.length}+ <span className="font-normal text-[#86868b]">EVs live</span></span>
              </div>

              <div className="mt-8 flex items-center gap-3.5">
                <a href="#marketplace" className="inline-flex h-[52px] items-center rounded-[999px] bg-[#1D6AE5] px-8 text-[16px] font-medium text-white transition-colors hover:bg-[#005bb5]">
                  Start driving
                </a>
                <Link href="/fleet/apply" className="inline-flex h-[52px] items-center rounded-[999px] border border-[#E0E0E0] px-8 text-[16px] font-medium text-[#1d1d1f] transition-colors hover:bg-white">
                  List your EV
                </Link>
              </div>

              <p className="mt-5 text-[13px] text-[#D1D5DB]">Contracts secured &middot; Payouts automated &middot; Fully verified drivers</p>
            </div>

            {/* Right — Earning Economics Panel */}
            <div className="rounded-2xl border border-[#d2d2d7] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#86868b]">Income dashboard</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73]">Vehicle type</label>
                  <select value={heroVehicleType} onChange={e => setHeroVehicleType(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[14px] text-[#1d1d1f] outline-none focus:border-[#1D6AE5]">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73]">Commitment</label>
                  <select value={heroCommitment} onChange={e => setHeroCommitment(e.target.value as 'weekly' | 'monthly')} className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[14px] text-[#1d1d1f] outline-none focus:border-[#1D6AE5]">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <p className="mt-1.5 text-[11px] text-[#86868b]">Longer commitment → higher earnings stability</p>
                </div>
              </div>

              {/* Commitment hint */}
              <p className="mt-3 text-[12px] text-[#6e6e73]">{commitmentHint}</p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-[#f5f5f7] px-4 py-3">
                  <span className="text-[13px] text-[#6e6e73]">Vehicle</span>
                  <span className="text-[14px] font-semibold text-[#1d1d1f]">{heroVehicle.brand} {heroVehicle.name.split(' ').slice(0, 2).join(' ')}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#f5f5f7] px-4 py-3">
                  <span className="text-[13px] text-[#6e6e73]">Rental</span>
                  <span className="text-[14px] font-semibold text-[#1d1d1f]">{usd(heroRental)}/day</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#f5f5f7] px-4 py-3">
                  <span className="text-[13px] text-[#6e6e73]">Driver earnings</span>
                  <span className="text-[14px] font-semibold text-emerald-600">{usd(DRIVER_DAILY_GROSS)}/day</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
                  <span className="text-[13px] font-medium text-emerald-700">Net after rental</span>
                  <span className="text-[17px] font-bold text-emerald-700">{usd(heroDriverNet)}/day</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#f5f5f7] pt-4 text-[12px] text-[#86868b]">
                <span>Owner earns {usd(heroOwnerEarnings)}/day</span>
                <span>TakeMe fee {usd(heroTakemeFee)}/day</span>
              </div>
              {heroCommitment === 'monthly' && (
                <p className="mt-3 text-center text-[11px] font-medium text-emerald-600">Recommended for maximum earnings</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRUST BAR ═════════════════════════════════════════════════════ */}
      <section className="border-y border-[#f5f5f7] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { value: `${FLEET.length}+`, label: 'EVs available' },
              { value: `${BRANDS.length}`, label: 'Brands' },
              { value: 'From $69', label: 'Per day' },
              { value: 'Verified', label: 'Fleet partners' },
            ].map((s, i) => (
              <div key={i} className={`flex flex-col items-center py-6 ${i > 0 ? 'border-l border-[#f5f5f7]' : ''}`}>
                <span className="text-[20px] font-bold tracking-[-0.02em] text-[#1d1d1f]">{s.value}</span>
                <span className="mt-0.5 text-[13px] font-medium text-[#86868b]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LIVE SYSTEM SIGNALS ══════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div className="mx-auto max-w-[1200px] px-6 py-4 lg:px-10">
          <div className="flex flex-wrap items-center justify-center gap-6 text-[13px]">
            <span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /><span className="tabular-nums font-medium text-[#1d1d1f]">32</span> <span className="text-[#86868b]">vehicles active today</span></span>
            <span className="h-3.5 w-px bg-[#d2d2d7]" />
            <span className="flex items-center gap-2"><span className="tabular-nums font-medium text-[#1d1d1f]">$18,420</span> <span className="text-[#86868b]">generated in 24h</span></span>
            <span className="h-3.5 w-px bg-[#d2d2d7]" />
            <span className="flex items-center gap-2"><span className="tabular-nums font-medium text-[#1d1d1f]">14</span> <span className="text-[#86868b]">new drivers joined</span></span>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ══════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div ref={howItWorks.ref} className={`mx-auto max-w-[1200px] px-6 py-24 md:py-28 lg:px-10 transition-all duration-[900ms] ease-out ${howItWorks.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">The system</p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            Three roles. One network.
          </h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              { step: '01', title: 'List your EV', desc: 'Upload → verify → activate income.' },
              { step: '02', title: 'TakeMe runs operations', desc: 'Contracts, payouts, risk, drivers — fully managed.' },
              { step: '03', title: 'Drivers generate revenue', desc: "Vehicles don't sit. They earn." },
            ].map(s => (
              <div key={s.step}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f5f7]">
                  <span className="text-[15px] font-bold tabular-nums text-[#1d1d1f]">{s.step}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-[#1d1d1f]">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.6] text-[#6e6e73]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ REAL EARNINGS ═════════════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div ref={earnings.ref} className={`mx-auto max-w-[1200px] px-6 py-24 md:py-28 lg:px-10 transition-all duration-[900ms] ease-out ${earnings.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">Economics</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
              {usd(Math.round(heroVehicle.dailyRate * OWNER_COMMISSION * roiDays))}/month per vehicle.
            </h2>
            {/* Day toggles */}
            <div className="flex gap-1 rounded-lg bg-white p-1 border border-[#d2d2d7]">
              {[5, 20, 30].map(d => (
                <button key={d} onClick={() => setRoiDays(d)} className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors ${roiDays === d ? 'bg-[#1d1d1f] text-white' : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}>{d} days</button>
              ))}
            </div>
          </div>

          {/* Comparison */}
          <div className="mt-6 flex items-center gap-4">
            <div className="rounded-xl bg-[#d2d2d7] px-5 py-3">
              <p className="text-[12px] text-[#86868b]">Idle EV</p>
              <p className="text-[20px] font-bold text-[#86868b]">$0</p>
            </div>
            <span className="text-[20px] text-[#d2d2d7]">→</span>
            <div className="rounded-xl bg-emerald-50 px-5 py-3">
              <p className="text-[12px] text-emerald-600">TakeMe Fleet</p>
              <p className="text-[20px] font-bold text-emerald-700">{usd(Math.round(heroVehicle.dailyRate * OWNER_COMMISSION * roiDays))}/mo</p>
            </div>
          </div>

          {/* ROI Calculator */}
          <div className="mt-8 rounded-2xl border border-[#d2d2d7] bg-white p-6">
            <p className="text-[13px] font-semibold text-[#1d1d1f]">Income breakdown</p>
            <p className="mt-1 text-[13px] text-[#86868b]">{heroVehicle.brand} {heroVehicle.name.split(' ').slice(0, 2).join(' ')} · {roiDays} days/month</p>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <EarningsCard label="Driver gross" value={usd(DRIVER_DAILY_GROSS * roiDays)} />
              <EarningsCard label="Vehicle cost" value={usd(heroVehicle.dailyRate * roiDays)} sub="Rental" />
              <EarningsCard label="Driver net" value={usd((DRIVER_DAILY_GROSS - heroVehicle.dailyRate) * roiDays)} accent />
              <EarningsCard label="Owner income" value={usd(Math.round(heroVehicle.dailyRate * OWNER_COMMISSION * roiDays))} sub="Passive" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ VEHICLE MARKETPLACE ═══════════════════════════════════════════ */}
      <section id="marketplace" className="bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-28 lg:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">Vehicles</p>
              <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
                Activate a vehicle.
              </h2>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select value={filters.category ?? ''} onChange={e => { setFilters(f => ({ ...f, category: e.target.value || undefined })); setPage(1); }} className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#1d1d1f] outline-none">
                <option value="">All types</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <select value={filters.brand ?? ''} onChange={e => { setFilters(f => ({ ...f, brand: e.target.value || undefined })); setPage(1); }} className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#1d1d1f] outline-none">
                <option value="">All brands</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={filters.priceRange ?? ''} onChange={e => { setFilters(f => ({ ...f, priceRange: (e.target.value || undefined) as FleetFilters['priceRange'] })); setPage(1); }} className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#1d1d1f] outline-none">
                <option value="">Any price</option>
                <option value="low">Under $100/day</option>
                <option value="mid">$100–$200/day</option>
                <option value="high">$200+/day</option>
              </select>
            </div>
          </div>

          <p className="mt-4 text-[14px] text-[#86868b]">{filtered.length} vehicle{filtered.length !== 1 ? 's' : ''} available</p>

          {/* Grid */}
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {shown.map(v => {
              const driverNet = DRIVER_DAILY_GROSS - v.dailyRate;
              const isTopROI = driverNet >= 130;
              return (
                <div key={v.key} className="group flex flex-col rounded-2xl border border-[#f5f5f7] bg-white p-5 transition-all duration-300 hover:border-[#d2d2d7] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5">
                  {/* Image placeholder */}
                  <div className="mb-4 flex h-40 items-center justify-center rounded-xl bg-[#f5f5f7]">
                    <svg className="h-14 w-14 text-[#d2d2d7]" fill="none" viewBox="0 0 24 24" strokeWidth={0.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h-.375a3 3 0 0 1-3-3V8.25m19.5 0a3 3 0 0 0-3-3h-1.172a3 3 0 0 0-2.121.878L8.689 10.5H3.375m16.5-6.375h-3.375" />
                    </svg>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${CATEGORY_COLORS[v.category] ?? 'bg-gray-50 text-gray-500'}`}>{v.category}</span>
                    {isTopROI && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600">Income ready</span>}
                  </div>

                  <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#86868b]">{v.brand}</p>
                  <h3 className="mt-0.5 text-[17px] font-semibold leading-tight text-[#1d1d1f]">{v.name}</h3>

                  {/* Specs */}
                  <div className="mt-2.5 flex items-center gap-3 text-[12px] text-[#6e6e73]">
                    <span>{v.rangeEpa} mi</span>
                    <span className="h-3 w-px bg-[#d2d2d7]" />
                    <span>{v.seats} seats</span>
                    <span className="h-3 w-px bg-[#d2d2d7]" />
                    <span>{v.zerotoSixty}</span>
                  </div>

                  <div className="flex-1" />

                  {/* Pricing + Earnings */}
                  <div className="mt-4 border-t border-[#f5f5f7] pt-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-[20px] font-bold tracking-[-0.02em] text-[#1d1d1f]">${v.dailyRate}</span>
                        <span className="text-[13px] text-[#6e6e73]">/day</span>
                        <p className="mt-0.5 text-[12px] text-[#86868b]">${v.weeklyRate}/week</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] text-[#86868b]">Est. driver net</p>
                        <p className="text-[16px] font-bold text-emerald-600">{usd(driverNet)}/day</p>
                      </div>
                    </div>
                    <button onClick={() => setBookingVehicle(v)} className="mt-4 flex w-full items-center justify-center rounded-[999px] bg-[#1D6AE5] py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#005bb5]">
                      Start driving
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button onClick={() => setPage(p => p + 1)} className="rounded-[999px] border border-[#E0E0E0] px-8 py-2.5 text-[14px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]">
                Show more vehicles
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ═══ OWNER VALUE ═══════════════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div ref={ownerSection.ref} className={`mx-auto max-w-[1200px] px-6 py-24 md:py-28 lg:px-10 transition-all duration-[900ms] ease-out ${ownerSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">For EV owners</p>
              <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
                Your EV is not a car.<br />It's an asset.
              </h2>
              <div className="mt-8 space-y-4">
                {['Deploy once', 'Earn continuously', 'Managed by TakeMe', 'Withdraw anytime'].map(t => (
                  <div key={t} className="flex items-center gap-3">
                    <svg className="h-5 w-5 text-[#1D6AE5]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    <span className="text-[16px] text-[#1d1d1f]">{t}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10">
                <Link href="/fleet/apply" className="inline-flex h-[52px] items-center rounded-[999px] bg-[#1D6AE5] px-8 text-[16px] font-medium text-white hover:bg-[#005bb5]">
                  List your vehicle
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-[#d2d2d7] bg-white p-6">
              <p className="text-[13px] font-semibold text-[#1d1d1f]">Owner earnings example</p>
              <p className="mt-1 text-[13px] text-[#86868b]">Tesla Model 3 at $89/day, 20 rental days/month</p>
              <div className="mt-5 space-y-3">
                <div className="flex justify-between text-[14px]"><span className="text-[#6e6e73]">Gross rental</span><span className="font-semibold text-[#1d1d1f]">$1,780</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-[#6e6e73]">TakeMe fee (20%)</span><span className="text-[#6e6e73]">−$356</span></div>
                <div className="flex justify-between border-t border-[#f5f5f7] pt-3 text-[16px]"><span className="font-medium text-[#1d1d1f]">Your payout</span><span className="font-bold text-emerald-600">$1,424/mo</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PLATFORM TRUST ════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div ref={trustSection.ref} className={`mx-auto max-w-[1200px] px-6 py-24 md:py-28 lg:px-10 transition-all duration-[900ms] ease-out ${trustSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">Platform layer</p>
          <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1d1d1f]">
            The infrastructure behind the income.
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Digital contracts', desc: 'Legally binding, hashed, immutable.' },
              { title: 'Automated payouts', desc: 'Weekly cash flow. Commission auto-deducted.' },
              { title: 'Driver verification', desc: 'Multi-layer KYC + risk scoring.' },
              { title: 'Fleet orchestration', desc: 'End-to-end booking, handoff, and return.' },
            ].map(t => (
              <div key={t.title} className="rounded-2xl bg-[#f5f5f7] p-6">
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{t.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#6e6e73]">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ NETWORK EFFECT ════════════════════════════════════════════════ */}
      <section className="border-y border-[#f5f5f7] bg-[#f5f5f7]">
        <div className="mx-auto max-w-[1200px] px-6 py-16 lg:px-10 text-center">
          <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
            The more drivers. The more income.
          </h2>
          <p className="mt-3 text-[15px] text-[#6e6e73]">As supply grows, utilization increases. Earnings compound.</p>
          <div className="mx-auto mt-8 flex max-w-lg items-center justify-center gap-3">
            {['Drivers', 'Vehicles', 'Earnings'].map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[14px] font-bold text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">{s}</div>
                </div>
                {i < 2 && <span className="text-[18px] text-[#d2d2d7]">↔</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══════════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div className="mx-auto max-w-[720px] px-6 py-24 md:py-28">
          <h2 className="text-center text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
            Common questions.
          </h2>
          <div className="mt-10 divide-y divide-[#f5f5f7]">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq.has(i);
              return (
                <div key={i} className="py-5">
                  <button onClick={() => setOpenFaq(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="flex w-full items-center justify-between text-left">
                    <span className="text-[16px] font-semibold text-[#1d1d1f]">{item.q}</span>
                    <span className="ml-4 shrink-0 text-[#86868b]">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && <p className="mt-3 text-[15px] leading-[1.65] text-[#6e6e73]">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═════════════════════════════════════════════════════ */}
      <section className="bg-[#f5f5f7]">
        <div className="mx-auto max-w-xl px-6 py-20 text-center">
          <h2 className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#1d1d1f]">
            Plug into the TakeMe income network.
          </h2>
          <p className="mt-4 text-[16px] text-[#6e6e73]">Drivers earn. Owners earn. TakeMe runs the system.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#marketplace" className="inline-flex h-[52px] items-center rounded-[999px] bg-[#1D6AE5] px-8 text-[16px] font-medium text-white hover:bg-[#005bb5]">
              Start driving
            </a>
            <Link href="/fleet/apply" className="inline-flex h-[52px] items-center rounded-[999px] border border-[#d2d2d7] px-8 text-[16px] font-medium text-[#1d1d1f] hover:bg-white">
              List your EV
            </Link>
          </div>
        </div>
      </section>

      {/* Footer rendered by root layout */}

      {/* ═══ BOOKING MODAL ═════════════════════════════════════════════════ */}
      {bookingVehicle && <BookingModal vehicle={bookingVehicle} onClose={() => setBookingVehicle(null)} />}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function EarningsCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${accent ? 'bg-emerald-50' : 'bg-[#f5f5f7]'}`}>
      <p className="text-[12px] font-medium text-[#86868b]">{label}</p>
      <p className={`mt-1 text-[22px] font-bold tracking-[-0.02em] ${accent ? 'text-emerald-700' : 'text-[#1d1d1f]'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-[#86868b]">{sub}</p>}
    </div>
  );
}

function BookingModal({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [location, setLocation] = useState(PICKUP_LOCATIONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const days = useMemo(() => {
    if (!pickupDate || !returnDate) return 0;
    return Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86_400_000));
  }, [pickupDate, returnDate]);

  const useWeekly = days >= 7;
  const fullWeeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  const total = useWeekly ? fullWeeks * vehicle.weeklyRate + remainingDays * vehicle.dailyRate : days * vehicle.dailyRate;

  const handleBook = async () => {
    if (!days) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setDone(true);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            </div>
            <h3 className="text-[20px] font-bold text-[#1d1d1f]">Booking confirmed.</h3>
            <p className="mt-2 text-[14px] text-[#6e6e73]">Check your email for pickup details.</p>
            <button onClick={onClose} className="mt-6 rounded-[999px] bg-[#1D6AE5] px-6 py-2.5 text-[14px] font-medium text-white">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-[#1d1d1f]">{vehicle.brand} {vehicle.name}</h3>
              <button onClick={onClose} className="text-[#86868b] hover:text-[#1d1d1f]">&times;</button>
            </div>
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73]">Pickup</label>
                  <input type="date" min={today} value={pickupDate} onChange={e => setPickupDate(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[14px] outline-none focus:border-[#1D6AE5]" />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73]">Return</label>
                  <input type="date" min={pickupDate || today} value={returnDate} onChange={e => setReturnDate(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[14px] outline-none focus:border-[#1D6AE5]" />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#6e6e73]">Location</label>
                <select value={location} onChange={e => setLocation(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[14px] outline-none focus:border-[#1D6AE5]">
                  {PICKUP_LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            {days > 0 && (
              <div className="mt-5 rounded-xl bg-[#f5f5f7] p-4 text-[14px]">
                <div className="flex justify-between"><span className="text-[#6e6e73]">{days} day{days > 1 ? 's' : ''} × ${useWeekly ? `${vehicle.weeklyRate}/wk` : `${vehicle.dailyRate}/day`}</span><span className="font-medium text-[#1d1d1f]">${total}</span></div>
                <div className="mt-2 flex justify-between text-[13px]"><span className="text-emerald-600">Est. net earnings</span><span className="font-semibold text-emerald-600">${(DRIVER_DAILY_GROSS - vehicle.dailyRate) * days}</span></div>
              </div>
            )}
            <button onClick={handleBook} disabled={!days || submitting} className="mt-5 flex w-full items-center justify-center rounded-[999px] bg-[#1D6AE5] py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#005bb5] disabled:opacity-40">
              {submitting ? 'Processing...' : days ? `Rent for ${usd(total)}` : 'Select dates'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
