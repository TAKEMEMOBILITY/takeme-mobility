'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME Driver Dashboard — the daily operating center for drivers
// ═══════════════════════════════════════════════════════════════════════════

// Sample data — replace with real API calls
const EARNINGS = { today: 142.50, week: 867.30, month: 3240.00, pending: 412.80, lastPayout: '2026-03-25' };
const DRIVER_BALANCE = { available: 412.80, cardBalance: 285.50, pending: 142.50, lifetime: 8740.00 };
const CARD = {
  active: true,
  balance: 285.50,
  lastCashout: '2026-03-28',
  number: '•••• 4829',
  virtualReady: true,
  physicalStatus: 'delivered' as 'none' | 'ordered' | 'shipping' | 'delivered',
  needsActivation: true,
  cashbackRate: 3,
  totalCashback: 47.20,
  walletAdded: true,
};
const STATS = { tripsToday: 6, tripsWeek: 34, rating: 4.92, acceptance: 96 };
const REWARDS = { tripsThisMonth: 87, target: 150, reward: '$200 Sephora Gift Card', status: 'in_progress' as const };

const RECENT_TRIPS = [
  { id: '1', pickup: 'Space Needle, Seattle', dropoff: 'SEA Airport', fare: 48.50, time: '2:15 PM', status: 'completed' },
  { id: '2', pickup: 'Pike Place Market', dropoff: 'Capitol Hill', fare: 14.20, time: '1:30 PM', status: 'completed' },
  { id: '3', pickup: 'University District', dropoff: 'Bellevue Square', fare: 32.80, time: '11:45 AM', status: 'completed' },
  { id: '4', pickup: 'SoDo', dropoff: 'Fremont', fare: 22.00, time: '10:20 AM', status: 'completed' },
];

const ALERTS = [
  { id: '1', type: 'warning' as const, text: 'Insurance expires in 14 days', action: 'Update' },
  { id: '2', type: 'info' as const, text: 'New reward milestone: 87/150 trips', action: 'View' },
];

export default function DriverDashboard() {
  const { user, loading } = useAuth();
  const [driverStatus, setDriverStatus] = useState<'online' | 'offline' | 'review'>('offline');
  const [acceptsPets, setAcceptsPets] = useState(false);
  const [maxPetSize, setMaxPetSize] = useState<'small' | 'medium' | 'large'>('large');
  const [payoutMethod, setPayoutMethod] = useState<'takeme_card' | 'bank' | 'debit'>('takeme_card');
  const [showFund, setShowFund] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [funding, setFunding] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [activateLast4, setActivateLast4] = useState('');
  const [activating, setActivating] = useState(false);
  const [cardActivated, setCardActivated] = useState(!CARD.needsActivation);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d2d2d7] border-t-[#1d1d1f]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="text-center">
          <h1 className="text-[22px] font-semibold text-[#1d1d1f]">Sign in to access your dashboard</h1>
          <Link href="/auth/login?redirect=/driver/dashboard" className="mt-4 inline-flex h-12 items-center rounded-[999px] bg-[#0071e3] px-7 text-[15px] font-semibold text-white hover:bg-[#005bb5]">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const rewardsPercent = Math.round((REWARDS.tripsThisMonth / REWARDS.target) * 100);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="bg-white border-b border-[#d2d2d7]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <Link href="/" className="text-[17px] tracking-[0.01em] text-[#1d1d1f]">
              <span className="font-semibold">TakeMe</span>
              <span className="ml-1 font-light text-[#86868b]">Driver</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              driverStatus === 'online' ? 'bg-[#34c759]/10 text-[#34c759]'
              : driverStatus === 'review' ? 'bg-[#FF9F0A]/10 text-[#FF9F0A]'
              : 'bg-[#d2d2d7] text-[#6e6e73]'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                driverStatus === 'online' ? 'bg-[#34c759]'
                : driverStatus === 'review' ? 'bg-[#FF9F0A]'
                : 'bg-[#6e6e73]'
              }`} />
              {driverStatus === 'online' ? 'Online' : driverStatus === 'review' ? 'Under Review' : 'Offline'}
            </div>
            <Link href="/driver" className="text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">
              Drive mode
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        {/* ── Alerts ──────────────────────────────────────────── */}
        {ALERTS.length > 0 && (
          <div className="mb-5 space-y-2">
            {ALERTS.map(alert => (
              <div key={alert.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                alert.type === 'warning' ? 'bg-[#FF9F0A]/8' : 'bg-[#0071e3]/6'
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 rounded-full ${alert.type === 'warning' ? 'bg-[#FF9F0A]' : 'bg-[#0071e3]'}`} />
                  <span className="text-[13px] font-medium text-[#1d1d1f]">{alert.text}</span>
                </div>
                <button className="text-[12px] font-semibold text-[#0071e3]">{alert.action}</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Top Stats ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Today's earnings", value: `$${EARNINGS.today.toFixed(2)}`, accent: true },
            { label: 'Trips today', value: String(STATS.tripsToday), accent: false },
            { label: 'Rating', value: STATS.rating.toFixed(2), accent: false },
            { label: 'Acceptance', value: `${STATS.acceptance}%`, accent: false },
          ].map(stat => (
            <div key={stat.label} className={`rounded-2xl p-5 ${stat.accent ? 'bg-[#0071e3] text-white' : 'bg-white'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${stat.accent ? 'text-white/40' : 'text-[#6e6e73]'}`}>{stat.label}</p>
              <p className={`mt-2 text-[28px] font-bold tabular-nums ${stat.accent ? 'text-white' : 'text-[#1d1d1f]'}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── Main Grid ───────────────────────────────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">

          {/* ── LEFT COLUMN ────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Earnings breakdown */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Earnings</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: 'Today', value: EARNINGS.today },
                  { label: 'This week', value: EARNINGS.week },
                  { label: 'This month', value: EARNINGS.month },
                  { label: 'Pending', value: EARNINGS.pending },
                ].map(e => (
                  <div key={e.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">{e.label}</p>
                    <p className="mt-1 text-[20px] font-bold tabular-nums text-[#1d1d1f]">${e.value.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#f5f5f7] pt-3">
                <p className="text-[12px] text-[#86868b]">Last payout: {new Date(EARNINGS.lastPayout).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                <button className="text-[12px] font-semibold text-[#0071e3]">View details</button>
              </div>
            </div>

            {/* TAKEME Card */}
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d1d1f] via-[#252527] to-[#2C2C2E]">
              {/* Card visual */}
              <div className="relative px-6 pt-6 pb-5">
                {/* Logo */}
                <div className="absolute right-5 top-5 flex items-center gap-1">
                  <div className="h-6 w-6 rounded-full bg-[#FF3B30] opacity-80" />
                  <div className="-ml-2.5 h-6 w-6 rounded-full bg-[#FF9500] opacity-80" />
                </div>

                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">TAKEME</p>
                  {CARD.virtualReady && (
                    <span className="rounded-full bg-[#34c759]/20 px-2 py-[1px] text-[8px] font-bold uppercase text-[#34c759]">Virtual active</span>
                  )}
                </div>
                <p className="mt-0.5 text-[17px] font-semibold text-white">Debit Card</p>

                <p className="mt-5 text-[20px] font-medium tracking-[0.2em] text-white/50">{CARD.number}</p>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Balance</p>
                    <p className="mt-0.5 text-[30px] font-bold tabular-nums leading-none text-white">${CARD.balance.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Cashback earned</p>
                    <p className="mt-0.5 text-[16px] font-bold tabular-nums text-[#34c759]">${CARD.totalCashback.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Card status bar */}
              <div className="border-t border-white/8 bg-white/[0.03] px-6 py-3">
                <div className="flex items-center justify-between">
                  {/* Wallet status */}
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-white/40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                    <span className="text-[11px] font-medium text-white/40">
                      {CARD.walletAdded ? 'Added to Apple Pay' : 'Add to wallet'}
                    </span>
                  </div>

                  {/* Physical card status */}
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      CARD.physicalStatus === 'delivered' ? 'bg-[#34c759]'
                      : CARD.physicalStatus === 'shipping' ? 'bg-[#FF9500]'
                      : 'bg-white/20'
                    }`} />
                    <span className="text-[11px] font-medium text-white/40">
                      {CARD.physicalStatus === 'delivered' ? 'Physical card active'
                      : CARD.physicalStatus === 'shipping' ? 'Card shipping'
                      : CARD.physicalStatus === 'ordered' ? 'Card ordered'
                      : 'Order physical card'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cashback rates */}
              <div className="border-t border-white/8 px-6 py-3">
                <div className="flex items-center gap-4">
                  {[
                    { label: 'EV charging', rate: '5%', color: '#34c759' },
                    { label: 'Gas', rate: '3%', color: '#FF9500' },
                    { label: 'Everything else', rate: '1%', color: '#0071e3' },
                  ].map(cb => (
                    <div key={cb.label} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cb.color }} />
                      <span className="text-[10px] text-white/30">{cb.label}</span>
                      <span className="text-[10px] font-bold text-white/60">{cb.rate}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activation banner */}
              {CARD.physicalStatus === 'delivered' && !cardActivated && (
                <div className="border-t border-white/10 px-6 py-4">
                  {!showActivate ? (
                    <button
                      onClick={() => setShowActivate(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF9500] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#E68A00]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      Activate physical card
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[13px] text-white/60">Enter the last 4 digits printed on your card</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={activateLast4}
                        onChange={(e) => setActivateLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="0000"
                        className="w-full rounded-xl bg-white/10 px-4 py-3 text-center text-[20px] font-bold tracking-[0.3em] text-white placeholder-white/20 outline-none focus:bg-white/15"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowActivate(false); setActivateLast4(''); }}
                          className="flex-1 rounded-xl bg-white/10 py-2.5 text-[13px] font-semibold text-white/60 hover:bg-white/15"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (activateLast4.length !== 4) return;
                            setActivating(true);
                            try {
                              const res = await fetch('/api/card/activate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ last4: activateLast4 }),
                              });
                              const data = await res.json();
                              if (!res.ok) { alert(data.error || 'Activation failed'); return; }
                              setCardActivated(true);
                              setShowActivate(false);
                            } catch { alert('Activation failed'); }
                            finally { setActivating(false); }
                          }}
                          disabled={activating || activateLast4.length !== 4}
                          className="flex-1 rounded-xl bg-[#FF9500] py-2.5 text-[13px] font-semibold text-white hover:bg-[#E68A00] disabled:opacity-40"
                        >
                          {activating ? 'Activating...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Primary action */}
              <div className="border-t border-white/10 px-6 py-4">
                <button className="flex w-full items-center justify-center rounded-xl bg-white py-3 text-[14px] font-semibold text-[#1d1d1f] transition-colors hover:bg-white/90">
                  Instant cash out
                </button>
              </div>

              {/* Secondary actions */}
              <div className="flex border-t border-white/10">
                <button className="flex-1 py-3 text-center text-[12px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/70">
                  View card
                </button>
                <div className="w-[1px] bg-white/10" />
                <button className="flex-1 py-3 text-center text-[12px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/70">
                  {CARD.physicalStatus === 'delivered' && !cardActivated ? 'Activate card' : CARD.physicalStatus === 'delivered' ? 'Manage card' : 'Order physical'}
                </button>
                <div className="w-[1px] bg-white/10" />
                <button className="flex-1 py-3 text-center text-[12px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/70">
                  Transactions
                </button>
              </div>
            </div>

            {/* Driver balance */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Your balance</h2>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Available</p>
                  <p className="mt-1 text-[22px] font-bold tabular-nums text-[#1d1d1f]">${DRIVER_BALANCE.available.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">On card</p>
                  <p className="mt-1 text-[22px] font-bold tabular-nums text-[#34c759]">${DRIVER_BALANCE.cardBalance.toFixed(2)}</p>
                </div>
              </div>

              {/* Fund card */}
              {!showFund ? (
                <button
                  onClick={() => setShowFund(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d2d2d7] py-3 text-[14px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
                >
                  <svg className="h-4 w-4 text-[#34c759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add funds to card
                </button>
              ) : (
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    {[25, 50, 100, 200].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setFundAmount(String(amt))}
                        className={`flex-1 rounded-lg border py-2 text-[13px] font-semibold transition-colors ${
                          fundAmount === String(amt)
                            ? 'border-[#0071e3] bg-[#0071e3] text-white'
                            : 'border-[#d2d2d7] text-[#1d1d1f] hover:border-[#d2d2d7]'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-[#d2d2d7] px-3 py-2">
                    <span className="text-[15px] font-medium text-[#6e6e73]">$</span>
                    <input
                      type="number"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      placeholder="Custom amount"
                      min={1}
                      max={5000}
                      className="w-full bg-transparent text-[15px] font-medium text-[#1d1d1f] outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowFund(false); setFundAmount(''); }}
                      className="flex-1 rounded-xl border border-[#d2d2d7] py-2.5 text-[13px] font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!fundAmount || Number(fundAmount) <= 0) return;
                        setFunding(true);
                        try {
                          const res = await fetch('/api/card/fund', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount: Number(fundAmount) }),
                          });
                          const data = await res.json();
                          if (!res.ok) alert(data.error || 'Transfer failed');
                          else { setShowFund(false); setFundAmount(''); }
                        } catch { alert('Transfer failed'); }
                        finally { setFunding(false); }
                      }}
                      disabled={funding || !fundAmount || Number(fundAmount) <= 0}
                      className="flex-1 rounded-xl bg-[#0071e3] py-2.5 text-[13px] font-semibold text-white hover:bg-[#005bb5] disabled:opacity-40"
                    >
                      {funding ? 'Transferring...' : `Transfer $${Number(fundAmount || 0).toFixed(2)}`}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-[#f5f5f7] pt-3">
                <p className="text-[11px] text-[#86868b]">Pending: ${DRIVER_BALANCE.pending.toFixed(2)}</p>
                <p className="text-[11px] text-[#86868b]">Lifetime: ${DRIVER_BALANCE.lifetime.toFixed(2)}</p>
              </div>
            </div>

            {/* Payout method */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Payout method</h2>
              <div className="mt-3 space-y-2">
                {([
                  { id: 'takeme_card' as const, label: 'TAKEME Card', desc: 'Instant · Cashback rewards', badge: 'Best', badgeColor: 'bg-[#34c759] text-white' },
                  { id: 'bank' as const, label: 'Bank account', desc: '1–3 business days', badge: null, badgeColor: '' },
                  { id: 'debit' as const, label: 'Debit card', desc: 'Within 30 minutes', badge: null, badgeColor: '' },
                ]).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPayoutMethod(opt.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
                      payoutMethod === opt.id
                        ? 'border-[#0071e3] bg-[#0071e3]/[0.03]'
                        : 'border-[#d2d2d7] hover:border-[#d2d2d7]'
                    }`}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      payoutMethod === opt.id ? 'border-[#0071e3]' : 'border-[#d2d2d7]'
                    }`}>
                      {payoutMethod === opt.id && <div className="h-2.5 w-2.5 rounded-full bg-[#0071e3]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[#1d1d1f]">{opt.label}</span>
                        {opt.badge && (
                          <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase leading-none ${opt.badgeColor}`}>{opt.badge}</span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#6e6e73]">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent trips */}
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Recent trips</h2>
                <span className="text-[12px] text-[#86868b]">{STATS.tripsToday} today</span>
              </div>
              <div className="mt-4 divide-y divide-[#f5f5f7]">
                {RECENT_TRIPS.map(trip => (
                  <div key={trip.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#34c759]" />
                        <p className="truncate text-[14px] font-medium text-[#1d1d1f]">{trip.pickup}</p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1d1d1f]" />
                        <p className="truncate text-[13px] text-[#6e6e73]">{trip.dropoff}</p>
                      </div>
                    </div>
                    <div className="ml-4 text-right shrink-0">
                      <p className="text-[15px] font-semibold tabular-nums text-[#1d1d1f]">${trip.fare.toFixed(2)}</p>
                      <p className="text-[11px] text-[#86868b]">{trip.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Quick actions</h2>
              <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
                {[
                  { label: 'Go online', icon: 'M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9', href: '/driver', green: true },
                  { label: 'Trips', icon: 'M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12', href: '#' },
                  { label: 'Vehicle', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', href: '#' },
                  { label: 'Documents', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z', href: '#' },
                  { label: 'Community', icon: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z', href: '#' },
                  { label: 'Support', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z', href: '#' },
                ].map(action => (
                  <Link key={action.label} href={action.href}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors ${
                      action.green ? 'border-[#34c759]/20 bg-[#34c759]/5 hover:bg-[#34c759]/10' : 'border-[#d2d2d7] hover:bg-[#f5f5f7]'
                    }`}>
                    <svg className={`h-5 w-5 ${action.green ? 'text-[#34c759]' : 'text-[#6e6e73]'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                    </svg>
                    <span className="text-[11px] font-medium text-[#1d1d1f]">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ───────────────────────────────────── */}
          <div className="space-y-5">

            {/* Driver Hub Membership */}
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Driver Hub</h2>
                <span className="rounded-full bg-[#34c759]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#34c759]">Active</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6e6e73]">Membership</span>
                  <span className="text-[13px] font-medium text-[#1d1d1f]">TakeMe Driver</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6e6e73]">Next billing</span>
                  <span className="text-[13px] font-medium text-[#1d1d1f]">Apr 1, 2026</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6e6e73]">Benefits</span>
                  <span className="text-[13px] font-medium text-[#34c759]">All unlocked</span>
                </div>
              </div>
              <button className="mt-4 w-full rounded-xl border border-[#d2d2d7] py-2.5 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]">
                Manage membership
              </button>
            </div>

            {/* TAKEME CONNECT */}
            <div className="rounded-2xl bg-[#1d1d1f] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                    <svg className="h-4 w-4 text-[#34c759]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                  </div>
                  <span className="text-[14px] font-semibold text-white">TAKEME CONNECT</span>
                </div>
                <span className="rounded-full bg-[#34c759]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#34c759]">Active</span>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[24px] font-bold tabular-nums text-white">$29.90</span>
                <span className="text-[13px] text-white/40">/month</span>
              </div>
              <p className="mt-1 text-[12px] text-white/40">Unlimited data & calls</p>
              <Link href="/driver/connect" className="mt-4 flex w-full items-center justify-center rounded-xl bg-white/10 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/15">
                Manage plan
              </Link>
            </div>

            {/* Women Driver Rewards */}
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Women Driver Rewards</h2>
                <span className="rounded-full bg-[#AF52DE]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#AF52DE]">In Progress</span>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-[#6e6e73]">{REWARDS.tripsThisMonth} of {REWARDS.target} trips</span>
                  <span className="text-[13px] font-semibold text-[#1d1d1f]">{rewardsPercent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f5f5f7]">
                  <div className="h-full rounded-full bg-[#AF52DE] transition-all duration-500" style={{ width: `${rewardsPercent}%` }} />
                </div>
                <p className="mt-3 text-[13px] text-[#6e6e73]">
                  Complete {REWARDS.target - REWARDS.tripsThisMonth} more trips to unlock:
                </p>
                <p className="mt-1 text-[15px] font-semibold text-[#AF52DE]">{REWARDS.reward}</p>
              </div>
            </div>

            {/* Community */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Community</h2>
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-3.5 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#0071e3]" />
                  <span className="text-[13px] text-[#1d1d1f]">Seattle driver meetup — Apr 5</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-3.5 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#34c759]" />
                  <span className="text-[13px] text-[#1d1d1f]">EV charging guide updated</span>
                </div>
              </div>
              <button className="mt-3 w-full rounded-xl border border-[#d2d2d7] py-2.5 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]">
                Open community
              </button>
            </div>

            {/* Pet rides */}
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-[16px]">🐾</span>
                  <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Pet Rides</h2>
                </div>
                <button
                  onClick={() => setAcceptsPets(!acceptsPets)}
                  className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${acceptsPets ? 'bg-[#FF9500]' : 'bg-[#d2d2d7]'}`}
                >
                  <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${acceptsPets ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {acceptsPets && (
                <div className="mt-3 space-y-2">
                  <p className="text-[12px] text-[#6e6e73]">You'll receive pet ride requests. Earn +$5–15 per trip.</p>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => setMaxPetSize(size)}
                        className={`flex-1 rounded-lg border py-2 text-[12px] font-medium transition-colors ${
                          maxPetSize === size || (['medium', 'large'].includes(size) && maxPetSize === 'large') || (size === 'medium' && maxPetSize !== 'small')
                            ? 'border-[#FF9500] bg-[#FF9500]/10 text-[#FF9500]'
                            : 'border-[#d2d2d7] text-[#6e6e73]'
                        }`}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#86868b]">Max size: {maxPetSize}</p>
                </div>
              )}
            </div>

            {/* Driver profile status */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Profile status</h2>
              <div className="mt-3 space-y-2.5">
                {[
                  { label: 'Verification', status: 'Verified', ok: true },
                  { label: 'Vehicle', status: 'Active', ok: true },
                  { label: 'Insurance', status: 'Expires soon', ok: false },
                  { label: 'License', status: 'Valid', ok: true },
                  { label: 'Pet rides', status: acceptsPets ? 'Enabled' : 'Disabled', ok: acceptsPets },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[13px] text-[#6e6e73]">{item.label}</span>
                    <span className={`text-[13px] font-medium ${item.ok ? 'text-[#34c759]' : 'text-[#FF9F0A]'}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
