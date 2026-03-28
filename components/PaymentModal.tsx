'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise = stripeKey ? loadStripe(stripeKey) : Promise.resolve(null);

// ---- Types ----------------------------------------------------------------

interface TripSummary {
  tripId: string;
  distance: number;
  duration: number;
  fare: number;
  currency: string;
}

interface PaymentModalProps {
  trip: TripSummary;
  onComplete: () => void;
  onDismiss: () => void;
  formatCurrency: (amount: number) => string;
  formatDistance: (km: number) => string;
}

// ---- PaymentForm — child of <Elements> ------------------------------------

function PaymentForm({
  trip,
  onComplete,
  onDismiss,
  formatCurrency,
}: {
  trip: TripSummary;
  onComplete: () => void;
  onDismiss: () => void;
  formatCurrency: (amount: number) => string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    console.log('[PaymentForm] mounted, stripe:', !!stripe, 'elements:', !!elements);
  }, [stripe, elements]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;

      setStatus('processing');
      setErrorMsg('');

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });

      if (error) {
        setStatus('error');
        setErrorMsg(error.message ?? 'Payment failed');
      } else {
        setStatus('success');
      }
    },
    [stripe, elements],
  );

  // ── Success state ─ Apple-style: centered, calm, confident ──────────
  if (status === 'success') {
    return (
      <div className="flex flex-col items-center py-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/12">
          <svg className="h-7 w-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="mt-4 text-lg font-semibold text-ink">Payment confirmed</p>
        <p className="mt-1 text-sm text-ink-secondary">Thank you for riding with us.</p>
        <button
          onClick={onComplete}
          className="mt-6 w-full rounded-xl bg-ink py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-ink/90 active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    );
  }

  // ── Payment form ────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        onReady={() => console.log('[PaymentForm] PaymentElement ready')}
        onLoadError={(e) => console.error('[PaymentForm] PaymentElement error:', e)}
      />

      {status === 'error' && errorMsg && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-danger/8 px-4 py-3">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-danger" />
          <p className="text-sm font-medium text-ink">{errorMsg}</p>
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onDismiss}
          disabled={status === 'processing'}
          className="flex-1 rounded-xl bg-surface-secondary py-3.5 text-[15px] font-semibold text-ink transition-colors hover:bg-surface-tertiary disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || status === 'processing'}
          className="flex-1 rounded-xl bg-ink py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
        >
          {status === 'processing' ? 'Processing...' : `Pay ${formatCurrency(trip.fare)}`}
        </button>
      </div>
    </form>
  );
}

// ---- PaymentModal ─────────────────────────────────────────────────────

export default function PaymentModal(props: PaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function createIntent() {
      try {
        console.log('[PaymentModal] Creating intent:', props.trip);

        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: props.trip.fare,
            tripId: props.trip.tripId,
            currency: props.trip.currency,
          }),
        });

        let data: { clientSecret?: string; error?: string };
        try {
          data = await res.json();
        } catch {
          throw new Error(`API returned non-JSON (status ${res.status})`);
        }

        if (!res.ok) throw new Error(data.error || `Payment failed (${res.status})`);
        if (!data.clientSecret) throw new Error('No clientSecret in response');
        if (cancelled) return;

        console.log('[PaymentModal] clientSecret:', data.clientSecret.slice(0, 25) + '...');
        setClientSecret(data.clientSecret);
      } catch (err) {
        if (cancelled) return;
        console.error('[PaymentModal] Error:', err);
        setLoadError(err instanceof Error ? err.message : 'Payment setup failed');
      }
    }

    createIntent();
    return () => { cancelled = true; };
  }, [props.trip.fare, props.trip.tripId, props.trip.currency]);

  // ── Modal shell ── Apple-style: centered, glass backdrop ────────────

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-surface shadow-[0_-4px_40px_rgba(0,0,0,0.12)] sm:rounded-2xl sm:shadow-[0_8px_40px_rgba(0,0,0,0.15)]">
        {/* Header — weight hierarchy, no border */}
        <div className="px-6 pt-6 pb-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
          <h2 className="text-lg font-semibold text-ink">Trip payment</h2>
        </div>

        {/* Trip summary — 3 columns, Apple-style */}
        <div className="mx-6 rounded-xl bg-surface-secondary px-4 py-3.5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">Distance</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {props.formatDistance(props.trip.distance)} km
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">Duration</p>
              <p className="mt-1 text-sm font-semibold text-ink">{props.trip.duration} min</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">Total</p>
              <p className="mt-1 text-base font-bold text-ink">
                {props.formatCurrency(props.trip.fare)}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );

  if (loadError) {
    return shell(
      <div className="flex flex-col items-center py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
          <svg className="h-6 w-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">Payment setup failed</p>
        <p className="mt-1 text-xs text-ink-tertiary">{loadError}</p>
        <button
          onClick={props.onDismiss}
          className="mt-5 w-full rounded-xl bg-surface-secondary py-3.5 text-[15px] font-semibold text-ink transition-colors hover:bg-surface-tertiary"
        >
          Close
        </button>
      </div>,
    );
  }

  if (!clientSecret) {
    return shell(
      <div className="flex flex-col items-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-ink" />
        <p className="mt-4 text-sm text-ink-secondary">Setting up payment...</p>
      </div>,
    );
  }

  return shell(
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#0C0C0E',
            colorBackground: '#F5F5F7',
            colorText: '#0C0C0E',
            colorTextSecondary: '#6B6B76',
            colorDanger: '#FF453A',
            fontFamily: 'var(--font-geist-sans), -apple-system, system-ui, sans-serif',
            borderRadius: '12px',
            spacingUnit: '4px',
          },
          rules: {
            '.Input': {
              border: '1px solid #E5E5EA',
              boxShadow: 'none',
              padding: '12px 14px',
              fontSize: '15px',
            },
            '.Input:focus': {
              border: '1px solid #0C0C0E',
              boxShadow: '0 0 0 1px #0C0C0E',
            },
            '.Label': {
              fontSize: '13px',
              fontWeight: '500',
              color: '#6B6B76',
              marginBottom: '6px',
            },
          },
        },
      }}
    >
      <PaymentForm
        trip={props.trip}
        onComplete={props.onComplete}
        onDismiss={props.onDismiss}
        formatCurrency={props.formatCurrency}
      />
    </Elements>,
  );
}
