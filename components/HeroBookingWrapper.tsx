'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

// ═══════════════════════════════════════════════════════════════════════════
// HeroBookingWrapper — Static booking card. Zero external SDKs.
// Google Maps, Stripe, and @react-google-maps/api fully removed.
// This version renders with zero crash risk.
// ═══════════════════════════════════════════════════════════════════════════

type VehicleClass = 'economy' | 'comfort' | 'premium';
const TIERS: { id: VehicleClass; name: string; icon: string }[] = [
  { id: 'economy', name: 'Economy', icon: '🚗' },
  { id: 'comfort', name: 'Comfort', icon: '🚙' },
  { id: 'premium', name: 'Premium', icon: '🚘' },
];

interface QuoteFare { total: number; baseFare: number; distanceFare: number; timeFare: number; surgeMultiplier: number; currency: string }
interface Quote { vehicleClass: VehicleClass; fare: QuoteFare }
interface RouteInfo { distanceKm: number; durationMin: number; polyline: string }

export default function HeroBookingWrapper({ ctaHref }: { ctaHref: string }) {
  const { user } = useAuth();
  const router = useRouter();

  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [selectedTier, setSelectedTier] = useState<VehicleClass>('comfort');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState('');

  const selectedQuote = quotes.find(q => q.vehicleClass === selectedTier);
  const hasQuote = quotes.length > 0 && route;

  // Fetch quotes via API (uses server-side Google Maps — no client SDK needed)
  const fetchQuotes = useCallback(async () => {
    if (!pickupText.trim() || !dropoffText.trim()) {
      setError('Enter both pickup and destination.');
      return;
    }
    setQuoteLoading(true);
    setError('');
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup: { address: pickupText },
          dropoff: { address: dropoffText },
          currency: 'USD',
          persist: false,
        }),
      });
      if (!res.ok) throw new Error('Route not available. Try different locations.');
      const data = await res.json();
      setQuotes(data.quotes ?? []);
      if (data.route) setRoute({ distanceKm: data.route.distanceKm, durationMin: data.route.durationMin, polyline: data.route.polyline });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not calculate route.');
      setQuotes([]);
      setRoute(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [pickupText, dropoffText]);

  // Confirm ride
  const confirmRide = useCallback(async () => {
    if (!user) { router.push(ctaHref); return; }
    const quote = quotes.find(q => q.vehicleClass === selectedTier);
    if (!quote || !route) return;

    setBooking(true);
    setError('');
    try {
      const res = await fetch('/api/rides/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: pickupText,
          pickupLat: 0, pickupLng: 0, // Server geocodes from address
          dropoffAddress: dropoffText,
          dropoffLat: 0, dropoffLng: 0,
          distanceKm: route.distanceKm,
          durationMin: route.durationMin,
          polyline: route.polyline,
          vehicleClass: selectedTier,
          baseFare: quote.fare.baseFare,
          distanceFare: quote.fare.distanceFare,
          timeFare: quote.fare.timeFare,
          totalFare: quote.fare.total,
          surgeMultiplier: quote.fare.surgeMultiplier,
          currency: quote.fare.currency,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) { router.push(ctaHref); return; }
        const data = await res.json();
        throw new Error(data.error || 'Booking failed');
      }
      setBooked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book ride.');
    } finally {
      setBooking(false);
    }
  }, [user, quotes, selectedTier, route, pickupText, dropoffText, ctaHref, router]);

  // ── Booked state ───────────────────────────────────────────────────
  if (booked) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">
        <div className="p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#34C759]/10">
            <svg className="h-7 w-7 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <p className="mt-4 text-[18px] font-semibold text-[#1D1D1F]">Ride confirmed</p>
          <p className="mt-1 text-[14px] text-[#86868B]">{pickupText} → {dropoffText}</p>
          <p className="mt-3 text-[22px] font-bold tabular-nums text-[#1D1D1F]">
            ${selectedQuote?.fare.total.toFixed(2)}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#1D1D1F] py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]"
          >
            Track your ride
          </button>
        </div>
      </div>
    );
  }

  // ── CTA ────────────────────────────────────────────────────────────
  const ctaLabel = booking ? 'Booking...'
    : quoteLoading ? 'Calculating...'
    : !user ? 'Sign in to book'
    : hasQuote ? `Confirm ride · $${selectedQuote?.fare.total.toFixed(2)}`
    : 'Get quote';

  const ctaAction = () => {
    if (!user) { router.push(ctaHref); return; }
    if (hasQuote) { confirmRide(); return; }
    fetchQuotes();
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_1px_20px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">

      {/* Map placeholder */}
      <div className="relative h-[200px] bg-[#F2F2F7] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08]">
          {[20,40,60,80].map(p => <div key={`h${p}`} className="absolute h-[1px] w-full bg-[#86868B]" style={{ top: `${p}%` }} />)}
          {[25,50,75].map(p => <div key={`v${p}`} className="absolute h-full w-[1px] bg-[#86868B]" style={{ left: `${p}%` }} />)}
        </div>
        {hasQuote ? (
          <div className="relative z-10 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34C759] opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34C759]" />
            </span>
            <span className="text-[13px] font-semibold text-[#1D1D1F]">{route!.durationMin} min · {route!.distanceKm} km</span>
          </div>
        ) : (
          <p className="relative z-10 text-[13px] text-[#A1A1A6]">Enter locations to see route</p>
        )}
      </div>

      {/* Form */}
      <div className="p-5">
        {error && (
          <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-[#FFF5F5] px-4 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
            <p className="text-[13px] text-[#1D1D1F]">{error}</p>
          </div>
        )}

        {/* Inputs */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#34C759]" />
            <input
              type="text"
              placeholder="Pickup location"
              value={pickupText}
              onChange={(e) => { setPickupText(e.target.value); setQuotes([]); setRoute(null); }}
              className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1D1D1F]" />
            <input
              type="text"
              placeholder="Where to?"
              value={dropoffText}
              onChange={(e) => { setDropoffText(e.target.value); setQuotes([]); setRoute(null); }}
              className="w-full bg-transparent text-[15px] font-medium text-[#1D1D1F] placeholder-[#A1A1A6] outline-none"
            />
          </div>
        </div>

        {/* Date/Time */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#F5F5F7] px-4 py-3">
            <svg className="h-4 w-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className="text-[14px] font-medium text-[#1D1D1F]">Today</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-[#F5F5F7] px-4 py-3">
            <svg className="h-4 w-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-[14px] font-medium text-[#1D1D1F]">Now</span>
          </div>
        </div>

        {/* Vehicle selector */}
        <div className="mt-4 flex gap-2">
          {TIERS.map(tier => {
            const active = selectedTier === tier.id;
            const quote = quotes.find(q => q.vehicleClass === tier.id);
            return (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`flex-1 rounded-xl px-2 py-3 text-center transition-all duration-150 ${
                  active ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED]'
                }`}
              >
                <p className="text-[16px] leading-none">{tier.icon}</p>
                <p className={`mt-1.5 text-[12px] font-semibold ${active ? 'text-white' : 'text-[#1D1D1F]'}`}>{tier.name}</p>
                <p className={`mt-0.5 text-[11px] tabular-nums ${active ? 'text-white/60' : 'text-[#86868B]'}`}>
                  {quote ? `$${quote.fare.total.toFixed(2)}` : '—'}
                </p>
              </button>
            );
          })}
        </div>

        {/* Fare */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F5F5F7] px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Estimated fare</p>
            <p className="mt-0.5 text-[22px] font-bold tabular-nums tracking-tight text-[#1D1D1F]">
              {quoteLoading ? <span className="inline-block h-5 w-16 animate-pulse rounded bg-[#E8E8ED]" />
                : selectedQuote ? `$${selectedQuote.fare.total.toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Distance</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#1D1D1F]">
              {route ? `${route.distanceKm} km` : '—'}
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={ctaAction}
          disabled={booking || quoteLoading}
          className={`mt-3 flex w-full items-center justify-center rounded-xl py-3.5 text-[15px] font-medium transition-colors duration-200 ${
            booking || quoteLoading ? 'bg-[#E8E8ED] text-[#A1A1A6]' : 'bg-[#1D1D1F] text-white hover:bg-[#424245]'
          }`}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
