'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME Driver Dashboard — the daily operating center for drivers
// ═══════════════════════════════════════════════════════════════════════════

// Sample data — replace with real API calls
const EARNINGS = { today: 142.50, week: 867.30, month: 3240.00, pending: 412.80, lastPayout: '2026-03-25' };
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#D2D2D7] border-t-[#1D1D1F]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="text-center">
          <h1 className="text-[22px] font-semibold text-[#1D1D1F]">Sign in to access your dashboard</h1>
          <Link href="/auth/login?redirect=/driver/dashboard" className="mt-4 inline-flex h-12 items-center rounded-[999px] bg-[#1D1D1F] px-7 text-[15px] font-semibold text-white hover:bg-[#333]">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const rewardsPercent = Math.round((REWARDS.tripsThisMonth / REWARDS.target) * 100);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="bg-white border-b border-[#E5E5EA]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <Link href="/" className="text-[17px] tracking-[0.01em] text-[#1D1D1F]">
              <span className="font-semibold">TakeMe</span>
              <span className="ml-1 font-light text-[#8E8E93]">Driver</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              driverStatus === 'online' ? 'bg-[#34C759]/10 text-[#34C759]'
              : driverStatus === 'review' ? 'bg-[#FF9F0A]/10 text-[#FF9F0A]'
              : 'bg-[#E5E5EA] text-[#86868B]'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                driverStatus === 'online' ? 'bg-[#34C759]'
                : driverStatus === 'review' ? 'bg-[#FF9F0A]'
                : 'bg-[#86868B]'
              }`} />
              {driverStatus === 'online' ? 'Online' : driverStatus === 'review' ? 'Under Review' : 'Offline'}
            </div>
            <Link href="/driver" className="text-[13px] font-medium text-[#86868B] hover:text-[#1D1D1F]">
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
                alert.type === 'warning' ? 'bg-[#FF9F0A]/8' : 'bg-[#0071E3]/6'
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 rounded-full ${alert.type === 'warning' ? 'bg-[#FF9F0A]' : 'bg-[#0071E3]'}`} />
                  <span className="text-[13px] font-medium text-[#1D1D1F]">{alert.text}</span>
                </div>
                <button className="text-[12px] font-semibold text-[#0071E3]">{alert.action}</button>
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
            <div key={stat.label} className={`rounded-2xl p-5 ${stat.accent ? 'bg-[#1D1D1F] text-white' : 'bg-white'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${stat.accent ? 'text-white/40' : 'text-[#86868B]'}`}>{stat.label}</p>
              <p className={`mt-2 text-[28px] font-bold tabular-nums ${stat.accent ? 'text-white' : 'text-[#1D1D1F]'}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── Main Grid ───────────────────────────────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">

          {/* ── LEFT COLUMN ────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Earnings breakdown */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Earnings</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: 'Today', value: EARNINGS.today },
                  { label: 'This week', value: EARNINGS.week },
                  { label: 'This month', value: EARNINGS.month },
                  { label: 'Pending', value: EARNINGS.pending },
                ].map(e => (
                  <div key={e.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A1A6]">{e.label}</p>
                    <p className="mt-1 text-[20px] font-bold tabular-nums text-[#1D1D1F]">${e.value.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#F5F5F7] pt-3">
                <p className="text-[12px] text-[#A1A1A6]">Last payout: {new Date(EARNINGS.lastPayout).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                <button className="text-[12px] font-semibold text-[#0071E3]">View details</button>
              </div>
            </div>

            {/* Recent trips */}
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Recent trips</h2>
                <span className="text-[12px] text-[#A1A1A6]">{STATS.tripsToday} today</span>
              </div>
              <div className="mt-4 divide-y divide-[#F5F5F7]">
                {RECENT_TRIPS.map(trip => (
                  <div key={trip.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#34C759]" />
                        <p className="truncate text-[14px] font-medium text-[#1D1D1F]">{trip.pickup}</p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1D1D1F]" />
                        <p className="truncate text-[13px] text-[#86868B]">{trip.dropoff}</p>
                      </div>
                    </div>
                    <div className="ml-4 text-right shrink-0">
                      <p className="text-[15px] font-semibold tabular-nums text-[#1D1D1F]">${trip.fare.toFixed(2)}</p>
                      <p className="text-[11px] text-[#A1A1A6]">{trip.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Quick actions</h2>
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
                      action.green ? 'border-[#34C759]/20 bg-[#34C759]/5 hover:bg-[#34C759]/10' : 'border-[#E5E5EA] hover:bg-[#F5F5F7]'
                    }`}>
                    <svg className={`h-5 w-5 ${action.green ? 'text-[#34C759]' : 'text-[#86868B]'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                    </svg>
                    <span className="text-[11px] font-medium text-[#1D1D1F]">{action.label}</span>
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
                <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Driver Hub</h2>
                <span className="rounded-full bg-[#34C759]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#34C759]">Active</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#86868B]">Membership</span>
                  <span className="text-[13px] font-medium text-[#1D1D1F]">TakeMe Driver</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#86868B]">Next billing</span>
                  <span className="text-[13px] font-medium text-[#1D1D1F]">Apr 1, 2026</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#86868B]">Benefits</span>
                  <span className="text-[13px] font-medium text-[#34C759]">All unlocked</span>
                </div>
              </div>
              <button className="mt-4 w-full rounded-xl border border-[#E5E5EA] py-2.5 text-[13px] font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]">
                Manage membership
              </button>
            </div>

            {/* TAKEME CONNECT */}
            <div className="rounded-2xl bg-[#1D1D1F] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                    <svg className="h-4 w-4 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                  </div>
                  <span className="text-[14px] font-semibold text-white">TAKEME CONNECT</span>
                </div>
                <span className="rounded-full bg-[#34C759]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#34C759]">Active</span>
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
                <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Women Driver Rewards</h2>
                <span className="rounded-full bg-[#AF52DE]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#AF52DE]">In Progress</span>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-[#86868B]">{REWARDS.tripsThisMonth} of {REWARDS.target} trips</span>
                  <span className="text-[13px] font-semibold text-[#1D1D1F]">{rewardsPercent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F5F5F7]">
                  <div className="h-full rounded-full bg-[#AF52DE] transition-all duration-500" style={{ width: `${rewardsPercent}%` }} />
                </div>
                <p className="mt-3 text-[13px] text-[#86868B]">
                  Complete {REWARDS.target - REWARDS.tripsThisMonth} more trips to unlock:
                </p>
                <p className="mt-1 text-[15px] font-semibold text-[#AF52DE]">{REWARDS.reward}</p>
              </div>
            </div>

            {/* Community */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Community</h2>
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-3.5 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#0071E3]" />
                  <span className="text-[13px] text-[#1D1D1F]">Seattle driver meetup — Apr 5</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-3.5 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#34C759]" />
                  <span className="text-[13px] text-[#1D1D1F]">EV charging guide updated</span>
                </div>
              </div>
              <button className="mt-3 w-full rounded-xl border border-[#E5E5EA] py-2.5 text-[13px] font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]">
                Open community
              </button>
            </div>

            {/* Pet rides */}
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-[16px]">🐾</span>
                  <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Pet Rides</h2>
                </div>
                <button
                  onClick={() => setAcceptsPets(!acceptsPets)}
                  className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${acceptsPets ? 'bg-[#FF9500]' : 'bg-[#E5E5EA]'}`}
                >
                  <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${acceptsPets ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {acceptsPets && (
                <div className="mt-3 space-y-2">
                  <p className="text-[12px] text-[#86868B]">You'll receive pet ride requests. Earn +$5–15 per trip.</p>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => setMaxPetSize(size)}
                        className={`flex-1 rounded-lg border py-2 text-[12px] font-medium transition-colors ${
                          maxPetSize === size || (['medium', 'large'].includes(size) && maxPetSize === 'large') || (size === 'medium' && maxPetSize !== 'small')
                            ? 'border-[#FF9500] bg-[#FF9500]/10 text-[#FF9500]'
                            : 'border-[#E5E5EA] text-[#86868B]'
                        }`}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#A1A1A6]">Max size: {maxPetSize}</p>
                </div>
              )}
            </div>

            {/* Driver profile status */}
            <div className="rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Profile status</h2>
              <div className="mt-3 space-y-2.5">
                {[
                  { label: 'Verification', status: 'Verified', ok: true },
                  { label: 'Vehicle', status: 'Active', ok: true },
                  { label: 'Insurance', status: 'Expires soon', ok: false },
                  { label: 'License', status: 'Valid', ok: true },
                  { label: 'Pet rides', status: acceptsPets ? 'Enabled' : 'Disabled', ok: acceptsPets },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[13px] text-[#86868B]">{item.label}</span>
                    <span className={`text-[13px] font-medium ${item.ok ? 'text-[#34C759]' : 'text-[#FF9F0A]'}`}>{item.status}</span>
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
