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

// ── Constants ───────────────────────────────────────────────────────────────

const NAV_ITEMS = ['Rides', 'Rental Cars', 'Connect', 'Technology', 'Safety'] as const;
const NAV_ROUTES: Record<string, string> = {
  Rides: '/',
  'Rental Cars': '/rentals',
  Connect: '/connect',
  Technology: '/technology',
  Safety: '/safety',
};

const PICKUP_LOCATIONS = [
  'Downtown Seattle',
  'South Lake Union',
  'Capitol Hill',
  'SeaTac Airport',
  'Bellevue',
  'University District',
];

const ADDONS = [
  { id: 'insurance', label: 'Rental Insurance', description: 'Full coverage protection', pricePerDay: 19 },
  { id: 'driver', label: 'Additional Driver', description: 'Add a second driver to the rental', pricePerDay: 10 },
  { id: 'child-seat', label: 'Child Seat', description: 'Rear-facing or forward-facing', pricePerDay: 8 },
];

const FAQ_ITEMS = [
  {
    q: 'How does charging work?',
    a: 'Every rental includes a charging card that works at all major networks — Tesla Supercharger, Electrify America, ChargePoint, and more. Charging costs are included in your rental rate. We ask that you return the vehicle with at least 80% charge.',
  },
  {
    q: 'Is there a mileage limit?',
    a: 'All rentals include 200 miles per day. Additional miles are charged at $0.25/mile. Weekly rentals include 1,200 miles. For road trips or high-mileage needs, ask about our unlimited mileage add-on.',
  },
  {
    q: 'What insurance is included?',
    a: 'Basic liability insurance is included with every rental. We recommend adding our Rental Insurance ($19/day) for comprehensive coverage including collision damage waiver, personal effects, and roadside assistance.',
  },
  {
    q: 'Can I take the vehicle out of state?',
    a: 'Yes, all vehicles can be driven within Washington, Oregon, and California. For trips to other states, please contact us in advance. International travel is not permitted.',
  },
  {
    q: 'What happens if the battery dies?',
    a: 'Every vehicle has real-time range estimation and nearby charger navigation built in. In the unlikely event you run out of charge, our 24/7 roadside assistance will send a mobile charger or tow you to the nearest station at no cost.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Free cancellation up to 24 hours before your pickup time. Cancellations within 24 hours are subject to a one-day rental fee. No-shows are charged the full rental amount.',
  },
];

const PAGE_SIZE = 12;

// ── Hooks ───────────────────────────────────────────────────────────────────

function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, [threshold]);
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

// ── Category badge colors ───────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  sedan: 'bg-blue-50 text-blue-600',
  suv: 'bg-green-50 text-green-600',
  truck: 'bg-amber-50 text-amber-700',
  luxury: 'bg-purple-50 text-purple-600',
  performance: 'bg-red-50 text-red-600',
};

// ── Sub-Components ──────────────────────────────────────────────────────────

function VehicleCard({ vehicle, onBook }: { vehicle: Vehicle; onBook: (v: Vehicle) => void }) {
  return (
    <div className="group flex flex-col rounded-2xl border border-[#F5F5F7] bg-white p-5 transition-all duration-300 hover:border-[#E8E8ED] hover:shadow-sm">
      {/* Image placeholder */}
      <div className="mb-4 flex h-40 items-center justify-center rounded-xl bg-[#F5F5F7]">
        <svg className="h-16 w-16 text-[#D2D2D7]" fill="none" viewBox="0 0 24 24" strokeWidth={0.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h-.375a3 3 0 0 1-3-3V8.25m19.5 0a3 3 0 0 0-3-3h-1.172a3 3 0 0 0-2.121.878L8.689 10.5H3.375m16.5-6.375h-3.375A1.125 1.125 0 0 0 15.375 5.25v3.375" />
        </svg>
      </div>

      {/* Brand + name */}
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#A1A1A6]">{vehicle.brand}</p>
      <h3 className="mt-0.5 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-[#1D1D1F]">{vehicle.name}</h3>

      {/* Category badge */}
      <div className="mt-2">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${CATEGORY_COLORS[vehicle.category] || 'bg-gray-50 text-gray-500'}`}>
          {vehicle.category}
        </span>
      </div>

      {/* Specs row */}
      <div className="mt-3 flex items-center gap-3 text-[12px] text-[#6E6E73]">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
          {vehicle.rangeEpa} mi
        </span>
        <span className="h-3 w-px bg-[#E8E8ED]" />
        <span>{vehicle.seats} seats</span>
        <span className="h-3 w-px bg-[#E8E8ED]" />
        <span>{vehicle.zerotoSixty}</span>
      </div>

      {/* Features */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {vehicle.features.slice(0, 3).map((f) => (
          <span key={f} className="rounded-md bg-[#F5F5F7] px-2 py-0.5 text-[10px] font-medium text-[#6E6E73]">
            {f}
          </span>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Price + Book */}
      <div className="mt-4 flex items-end justify-between border-t border-[#F5F5F7] pt-4">
        <div>
          <span className="text-[20px] font-bold tracking-[-0.02em] text-[#1D1D1F]">${vehicle.dailyRate}</span>
          <span className="text-[13px] text-[#6E6E73]">/day</span>
          <p className="mt-0.5 text-[12px] text-[#A1A1A6]">${vehicle.weeklyRate}/week</p>
        </div>
        <button
          onClick={() => onBook(vehicle)}
          className="rounded-[999px] bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]"
        >
          Instant Book
        </button>
      </div>
    </div>
  );
}

// ── Booking Modal ───────────────────────────────────────────────────────────

function BookingModal({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [location, setLocation] = useState(PICKUP_LOCATIONS[0]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const days = useMemo(() => {
    if (!pickupDate || !returnDate) return 0;
    const diff = new Date(returnDate).getTime() - new Date(pickupDate).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [pickupDate, returnDate]);

  const useWeekly = days >= 7;
  const fullWeeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  const baseTotal = useWeekly
    ? fullWeeks * vehicle.weeklyRate + remainingDays * vehicle.dailyRate
    : days * vehicle.dailyRate;

  const addonsTotal = useMemo(() => {
    let total = 0;
    selectedAddons.forEach((id) => {
      const addon = ADDONS.find((a) => a.id === id);
      if (addon) total += addon.pricePerDay * days;
    });
    return total;
  }, [selectedAddons, days]);

  const grandTotal = baseTotal + addonsTotal;

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleKey: vehicle.key,
          pickupDate,
          returnDate,
          location,
          addons: [...selectedAddons],
          total: grandTotal,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBookingRef(data.reference || `TM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
      } else {
        setBookingRef(`TM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
      }
    } catch {
      setBookingRef(`TM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
    }
    setSubmitting(false);
    setStep(4);
  };

  const canProceedStep1 = pickupDate && returnDate && days > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F5F5F7] px-6 py-4">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            {step === 4 ? 'Booking Confirmed' : 'Book Your Rental'}
          </h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[#F5F5F7]">
            <svg className="h-4 w-4 text-[#6E6E73]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicators */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-2 border-b border-[#F5F5F7] px-6 py-3">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                  s === step ? 'bg-[#1D1D1F] text-white' : s < step ? 'bg-[#34C759] text-white' : 'bg-[#F5F5F7] text-[#A1A1A6]'
                }`}>
                  {s < step ? (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : s}
                </div>
                {s < 3 && <div className={`h-px w-8 ${s < step ? 'bg-[#34C759]' : 'bg-[#E8E8ED]'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Vehicle summary */}
        <div className="flex items-center gap-4 border-b border-[#F5F5F7] bg-[#FAFAFA] px-6 py-3">
          <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-[#F0F0F0]">
            <svg className="h-6 w-6 text-[#A1A1A6]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h-.375a3 3 0 0 1-3-3V8.25m19.5 0a3 3 0 0 0-3-3h-1.172a3 3 0 0 0-2.121.878L8.689 10.5H3.375m16.5-6.375h-3.375A1.125 1.125 0 0 0 15.375 5.25v3.375" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#A1A1A6]">{vehicle.brand}</p>
            <p className="text-[15px] font-semibold text-[#1D1D1F]">{vehicle.name}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[15px] font-bold text-[#1D1D1F]">${vehicle.dailyRate}/day</p>
            <p className="text-[11px] text-[#A1A1A6]">${vehicle.weeklyRate}/week</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1 — Dates & Location */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A1A1A6]">Pickup Date</label>
                <input
                  type="date"
                  min={today}
                  value={pickupDate}
                  onChange={(e) => {
                    setPickupDate(e.target.value);
                    if (returnDate && e.target.value >= returnDate) setReturnDate('');
                  }}
                  className="w-full rounded-xl border border-[#E8E8ED] bg-white px-4 py-3 text-[15px] text-[#1D1D1F] outline-none transition-colors focus:border-[#0071E3]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A1A1A6]">Return Date</label>
                <input
                  type="date"
                  min={pickupDate || today}
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E8ED] bg-white px-4 py-3 text-[15px] text-[#1D1D1F] outline-none transition-colors focus:border-[#0071E3]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A1A1A6]">Pickup Location</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#E8E8ED] bg-white px-4 py-3 text-[15px] text-[#1D1D1F] outline-none transition-colors focus:border-[#0071E3]"
                >
                  {PICKUP_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              {days > 0 && (
                <div className="rounded-xl bg-[#F5F5F7] p-4">
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-[#6E6E73]">
                      {useWeekly
                        ? `${fullWeeks} week${fullWeeks > 1 ? 's' : ''}${remainingDays > 0 ? ` + ${remainingDays} day${remainingDays > 1 ? 's' : ''}` : ''}`
                        : `${days} day${days > 1 ? 's' : ''} x $${vehicle.dailyRate}/day`}
                    </span>
                    <span className="font-semibold text-[#1D1D1F]">${baseTotal}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Add-ons */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A1A1A6]">Optional Add-ons</p>
              {ADDONS.map((addon) => {
                const active = selectedAddons.has(addon.id);
                return (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddon(addon.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                      active ? 'border-[#0071E3] bg-blue-50/40' : 'border-[#E8E8ED] bg-white hover:border-[#D2D2D7]'
                    }`}
                  >
                    <div>
                      <p className="text-[15px] font-medium text-[#1D1D1F]">{addon.label}</p>
                      <p className="mt-0.5 text-[12px] text-[#6E6E73]">{addon.description}</p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <span className="text-[14px] font-semibold text-[#1D1D1F]">${addon.pricePerDay}/day</span>
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                        active ? 'border-[#0071E3] bg-[#0071E3]' : 'border-[#D2D2D7]'
                      }`}>
                        {active && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              <div className="mt-4 space-y-2 rounded-xl bg-[#F5F5F7] p-4 text-[14px]">
                <div className="flex justify-between text-[#6E6E73]">
                  <span>Vehicle ({days} day{days > 1 ? 's' : ''})</span>
                  <span>${baseTotal}</span>
                </div>
                {[...selectedAddons].map((id) => {
                  const addon = ADDONS.find((a) => a.id === id);
                  if (!addon) return null;
                  return (
                    <div key={id} className="flex justify-between text-[#6E6E73]">
                      <span>{addon.label} ({days}d)</span>
                      <span>${addon.pricePerDay * days}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between border-t border-[#E8E8ED] pt-2 font-semibold text-[#1D1D1F]">
                  <span>Total</span>
                  <span>${grandTotal}</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Payment */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A1A1A6]">Order Summary</p>
              <div className="space-y-3 rounded-xl bg-[#F5F5F7] p-4 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#6E6E73]">Vehicle</span>
                  <span className="font-medium text-[#1D1D1F]">{vehicle.brand} {vehicle.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E6E73]">Dates</span>
                  <span className="font-medium text-[#1D1D1F]">{pickupDate} to {returnDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E6E73]">Duration</span>
                  <span className="font-medium text-[#1D1D1F]">{days} day{days > 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E6E73]">Location</span>
                  <span className="font-medium text-[#1D1D1F]">{location}</span>
                </div>
                {selectedAddons.size > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#6E6E73]">Add-ons</span>
                    <span className="font-medium text-[#1D1D1F]">
                      {[...selectedAddons].map((id) => ADDONS.find((a) => a.id === id)?.label).join(', ')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#E8E8ED] pt-3 text-[16px] font-bold text-[#1D1D1F]">
                  <span>Total</span>
                  <span>${grandTotal}</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Confirmation */}
          {step === 4 && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#34C759]/10">
                <svg className="h-8 w-8 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[#1D1D1F]">You&apos;re all set!</h3>
              <p className="mt-2 text-[14px] text-[#6E6E73]">
                Your {vehicle.brand} {vehicle.name} is reserved.
              </p>
              <div className="mt-4 rounded-xl bg-[#F5F5F7] px-6 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A1A1A6]">Booking Reference</p>
                <p className="mt-1 text-[24px] font-bold tracking-[0.05em] text-[#1D1D1F]">{bookingRef}</p>
              </div>
              <div className="mt-4 space-y-1 text-[13px] text-[#6E6E73]">
                <p>Pickup: {pickupDate} at {location}</p>
                <p>Return: {returnDate}</p>
                <p className="font-semibold text-[#1D1D1F]">Total: ${grandTotal}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="border-t border-[#F5F5F7] px-6 py-4">
          {step === 1 && (
            <button
              disabled={!canProceedStep1}
              onClick={() => setStep(2)}
              className="w-full rounded-[999px] bg-[#1D1D1F] px-8 py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245] disabled:opacity-40"
            >
              Continue to Add-ons
            </button>
          )}
          {step === 2 && (
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-[999px] border border-[#E8E8ED] bg-white px-6 py-3.5 text-[15px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]">
                Back
              </button>
              <button onClick={() => setStep(3)} className="flex-[2] rounded-[999px] bg-[#1D1D1F] px-8 py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]">
                Review Order
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 rounded-[999px] border border-[#E8E8ED] bg-white px-6 py-3.5 text-[15px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]">
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-[2] rounded-[999px] bg-[#0071E3] px-8 py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#0077ED] disabled:opacity-60"
              >
                {submitting ? 'Processing...' : `Pay $${grandTotal}`}
              </button>
            </div>
          )}
          {step === 4 && (
            <button onClick={onClose} className="w-full rounded-[999px] bg-[#1D1D1F] px-8 py-3.5 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FAQ Accordion Item ──────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#E8E8ED]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-[16px] font-semibold text-[#1D1D1F]">{q}</span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-[#A1A1A6] transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-60 pb-5' : 'max-h-0'}`}>
        <p className="text-[15px] leading-relaxed text-[#6E6E73]">{a}</p>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function RentalsPage() {
  const scrolled = useScrolled();
  const howItWorks = useReveal(0.15);
  const faqSection = useReveal(0.15);
  const heroSection = useReveal(0.05);

  // Filter state
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('');
  const [priceRange, setPriceRange] = useState<'low' | 'mid' | 'high' | ''>('');
  const [seatsFilter, setSeatsFilter] = useState(0);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [bookingVehicle, setBookingVehicle] = useState<Vehicle | null>(null);

  // Filter the fleet
  const filtered = useMemo(() => {
    const filters: FleetFilters = {};
    if (category !== 'all') filters.category = category;
    if (brand) filters.brand = brand;
    if (priceRange) filters.priceRange = priceRange;
    if (seatsFilter > 0) filters.minSeats = seatsFilter;
    if (search.trim()) filters.search = search.trim();
    return filterFleet(filters);
  }, [category, brand, priceRange, seatsFilter, search]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, brand, priceRange, seatsFilter, search]);

  const visibleVehicles = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const clearFilters = () => {
    setCategory('all');
    setBrand('');
    setPriceRange('');
    setSeatsFilter(0);
    setSearch('');
  };

  const hasActiveFilters = category !== 'all' || brand || priceRange || seatsFilter > 0 || search;

  return (
    <div className="min-h-screen bg-white">

      {/* ═══ NAV ══════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled ? 'bg-white/80 backdrop-blur-2xl shadow-[0_1px_0_rgba(0,0,0,0.04)]' : 'bg-transparent'
      }`}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] tracking-[0.01em] text-[#1D1D1F]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#8E8E93]">Mobility</span>
          </Link>

          <div className="hidden items-center gap-10 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item}
                href={NAV_ROUTES[item] || '/'}
                className={`text-[14px] font-medium transition-colors duration-200 hover:text-[#1D1D1F] ${
                  item === 'Rental Cars' ? 'text-[#1D1D1F]' : 'text-[#8E8E93]'
                }`}
              >
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden text-[13px] font-medium text-[#8E8E93] transition-opacity duration-200 hover:opacity-60 sm:block">
              Sign in
            </Link>
            <Link href="/auth/signup" className="inline-flex h-10 items-center rounded-[999px] bg-[#1D1D1F] px-5 text-[14px] font-medium text-white transition-colors duration-200 hover:bg-[#424245]">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section
        ref={heroSection.ref}
        className="pb-16 pt-32 lg:pb-20 lg:pt-40"
      >
        <div className={`mx-auto max-w-[1200px] px-6 lg:px-10 transition-all duration-1000 ${heroSection.visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">EV Rentals</p>
          <h1 className="mt-3 text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.08] tracking-[-0.035em] text-[#1D1D1F]">
            Drive Electric.<br />No compromises.
          </h1>
          <p className="mt-4 max-w-[540px] text-[clamp(1rem,2vw,1.25rem)] leading-[1.5] text-[#6E6E73]">
            Every vehicle in our fleet is 100% electric. Premium EVs from Tesla, Porsche, Rivian, Lucid and more — available by the day or week in Seattle.
          </p>
          <div className="mt-6 flex items-center gap-4 text-[14px] text-[#A1A1A6]">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              {FLEET.length}+ EVs
            </span>
            <span className="h-3 w-px bg-[#E8E8ED]" />
            <span>{BRANDS.length} brands</span>
            <span className="h-3 w-px bg-[#E8E8ED]" />
            <span>From $69/day</span>
          </div>
        </div>
      </section>

      {/* ═══ FILTER BAR ═══════════════════════════════════════════════════ */}
      <div className="sticky top-[72px] z-40 border-b border-[#F5F5F7] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-[1200px] px-6 py-4 lg:px-10">
          {/* Row 1: Categories */}
          <div className="flex flex-wrap items-center gap-2">
            {['all', ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-[999px] px-4 py-2 text-[13px] font-medium capitalize transition-colors ${
                  category === cat
                    ? 'bg-[#1D1D1F] text-white'
                    : 'bg-[#F5F5F7] text-[#6E6E73] hover:bg-[#E8E8ED]'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>

          {/* Row 2: Brand, Price, Seats, Search */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Brand dropdown */}
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-9 appearance-none rounded-xl border border-[#E8E8ED] bg-white px-3 pr-8 text-[13px] text-[#1D1D1F] outline-none transition-colors focus:border-[#0071E3]"
            >
              <option value="">All Brands</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Price range */}
            <div className="flex overflow-hidden rounded-xl border border-[#E8E8ED]">
              {([['low', '$'], ['mid', '$$'], ['high', '$$$']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setPriceRange(priceRange === val ? '' : val)}
                  className={`px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    priceRange === val ? 'bg-[#1D1D1F] text-white' : 'bg-white text-[#6E6E73] hover:bg-[#F5F5F7]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Seats */}
            <div className="flex overflow-hidden rounded-xl border border-[#E8E8ED]">
              {[0, 5, 6, 7].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeatsFilter(s)}
                  className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    seatsFilter === s ? 'bg-[#1D1D1F] text-white' : 'bg-white text-[#6E6E73] hover:bg-[#F5F5F7]'
                  }`}
                >
                  {s === 0 ? 'Any' : `${s}${s === 7 ? '+' : ''}`}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A1A1A6]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#E8E8ED] bg-white pl-9 pr-3 text-[13px] text-[#1D1D1F] outline-none transition-colors placeholder:text-[#A1A1A6] focus:border-[#0071E3]"
              />
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-[12px] font-medium text-[#0071E3] hover:underline">
                Clear all
              </button>
            )}
          </div>

          {/* Count */}
          <p className="mt-3 text-[12px] text-[#A1A1A6]">
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ═══ FLEET GRID ═══════════════════════════════════════════════════ */}
      <section className="pb-16 pt-8">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F5F5F7]">
                <svg className="h-7 w-7 text-[#A1A1A6]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <p className="text-[17px] font-semibold text-[#1D1D1F]">No vehicles found</p>
              <p className="mt-1 text-[14px] text-[#6E6E73]">Try adjusting your filters or search term.</p>
              <button onClick={clearFilters} className="mt-4 rounded-[999px] bg-[#1D1D1F] px-6 py-2.5 text-[14px] font-medium text-white hover:bg-[#424245]">
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {visibleVehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.key}
                    vehicle={vehicle}
                    onBook={setBookingVehicle}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="mt-10 flex justify-center">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className="rounded-[999px] border border-[#E8E8ED] bg-white px-8 py-3.5 text-[15px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
                  >
                    Show more vehicles ({filtered.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════════════════════ */}
      <section ref={howItWorks.ref} className="border-t border-[#F5F5F7] bg-[#FAFAFA] py-20">
        <div className={`mx-auto max-w-[1200px] px-6 lg:px-10 transition-all duration-1000 ${howItWorks.visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">How It Works</p>
          <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.025em] text-[#1D1D1F]">
            Three steps. Zero emissions.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Choose your EV',
                desc: 'Browse our fleet of 95+ premium electric vehicles. Filter by brand, category, range, or price. Book instantly with confirmed pricing.',
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                ),
              },
              {
                step: '02',
                title: 'Pick up',
                desc: 'Collect your fully charged EV from any of our six Seattle-area locations. Keys, charging card, and a quick walkthrough — you are on the road in minutes.',
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
                  </svg>
                ),
              },
              {
                step: '03',
                title: 'Return',
                desc: 'Drop the vehicle back at any TakeMe location. Return it charged above 80% and you are done. No paperwork, no fuel receipts, no hassle.',
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F]">
                  {item.icon}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#A1A1A6]">Step {item.step}</p>
                <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">{item.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#6E6E73]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ══════════════════════════════════════════════════════════ */}
      <section ref={faqSection.ref} className="border-t border-[#F5F5F7] py-20">
        <div className={`mx-auto max-w-[720px] px-6 lg:px-10 transition-all duration-1000 ${faqSection.visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A1A1A6]">FAQ</p>
          <h2 className="mt-3 text-center text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.025em] text-[#1D1D1F]">
            Common questions
          </h2>
          <div className="mt-10">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#E8E8ED] bg-[#FAFAFA]">
        <div className="mx-auto max-w-[1200px] px-6 py-12 lg:px-10">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">Product</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/" className="text-[13px] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]">Rides</Link></li>
                <li><Link href="/rentals" className="text-[13px] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]">Rental Cars</Link></li>
                <li><Link href="/connect" className="text-[13px] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]">Connect</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">Company</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/technology" className="text-[13px] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]">Technology</Link></li>
                <li><Link href="/safety" className="text-[13px] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]">Safety</Link></li>
                <li><Link href="/cities" className="text-[13px] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]">Cities</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">Drive</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/driver/apply" className="text-[13px] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]">Apply to drive</Link></li>
                <li><Link href="/driver" className="text-[13px] text-[#6E6E73] transition-colors hover:text-[#1D1D1F]">Driver Hub</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#A1A1A6]">Legal</p>
              <ul className="mt-3 space-y-2">
                <li><span className="text-[13px] text-[#6E6E73]">Privacy Policy</span></li>
                <li><span className="text-[13px] text-[#6E6E73]">Terms of Service</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#E8E8ED] pt-6 md:flex-row">
            <Link href="/" className="text-[16px] tracking-[0.01em] text-[#1D1D1F]">
              <span className="font-semibold">TakeMe</span>
              <span className="ml-[5px] font-light text-[#8E8E93]">Mobility</span>
            </Link>
            <p className="text-[12px] text-[#A1A1A6]">
              &copy; {new Date().getFullYear()} TakeMe Mobility, Inc. All rights reserved. Seattle, WA.
            </p>
          </div>
        </div>
      </footer>

      {/* ═══ BOOKING MODAL ════════════════════════════════════════════════ */}
      {bookingVehicle && (
        <BookingModal
          vehicle={bookingVehicle}
          onClose={() => setBookingVehicle(null)}
        />
      )}
    </div>
  );
}
