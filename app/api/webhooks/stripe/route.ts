import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { createServerClient } from '@supabase/ssr';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/webhooks/stripe
//
// Handles Stripe webhook events. Uses the service role key to bypass RLS —
// webhooks run without a user session.
//
// Events handled:
//   payment_intent.amount_capturable_updated — authorization successful
//   payment_intent.succeeded                 — capture complete
//   payment_intent.payment_failed            — payment failed
//   charge.refunded                          — refund processed
//   charge.dispute.created                   — dispute opened
// ═══════════════════════════════════════════════════════════════════════════

// Service role client — bypasses RLS for webhook writes
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fall back to anon key if service key not set (dev mode)
  const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, key, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // 2. Verify webhook signature
    let event: Record<string, unknown>;
    try {
      event = await verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      console.error('Webhook signature failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const eventType = event.type as string;
    const data = event.data as { object: Record<string, unknown> };
    const obj = data.object;

    console.log(`[Stripe Webhook] ${eventType}:`, obj.id);

    const supabase = createServiceClient();

    // 3. Route by event type
    switch (eventType) {
      // ── Authorization successful ─────────────────────────────────────
      case 'payment_intent.amount_capturable_updated': {
        const piId = obj.id as string;
        const rideId = (obj.metadata as Record<string, string>)?.ride_id;

        await supabase
          .from('payments')
          .update({
            status: 'authorized',
            authorized_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent', piId);

        // Save the payment method for future rides
        const pmId = obj.payment_method as string | null;
        if (pmId && rideId) {
          const { data: payment } = await supabase
            .from('payments')
            .select('rider_id')
            .eq('stripe_payment_intent', piId)
            .single();

          if (payment?.rider_id) {
            await supabase
              .from('riders')
              .update({
                default_payment_method: pmId,
              })
              .eq('id', payment.rider_id);

            await supabase
              .from('payments')
              .update({ payment_method_type: 'card' })
              .eq('stripe_payment_intent', piId);
          }
        }

        break;
      }

      // ── Capture succeeded (ride complete, funds collected) ───────────
      case 'payment_intent.succeeded': {
        const piId = obj.id as string;
        const chargeId = (obj.latest_charge as string) ?? null;

        await supabase
          .from('payments')
          .update({
            status: 'captured',
            stripe_charge_id: chargeId,
            captured_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent', piId);

        // Mark ride as completed if not already
        const rideId = (obj.metadata as Record<string, string>)?.ride_id;
        if (rideId) {
          await supabase
            .from('rides')
            .update({
              status: 'completed',
              final_fare: Number(obj.amount_received ?? obj.amount) / 100,
              trip_completed_at: new Date().toISOString(),
            })
            .eq('id', rideId)
            .neq('status', 'completed');
        }

        break;
      }

      // ── Payment failed ──────────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const piId = obj.id as string;
        const lastError = obj.last_payment_error as { message?: string } | null;

        await supabase
          .from('payments')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            failure_reason: lastError?.message ?? 'Payment declined',
          })
          .eq('stripe_payment_intent', piId);

        break;
      }

      // ── Refund processed ────────────────────────────────────────────
      case 'charge.refunded': {
        const piId = obj.payment_intent as string;

        if (piId) {
          await supabase
            .from('payments')
            .update({
              status: 'refunded',
              refunded_at: new Date().toISOString(),
            })
            .eq('stripe_payment_intent', piId);
        }

        break;
      }

      // ── Dispute opened ──────────────────────────────────────────────
      case 'charge.dispute.created': {
        const piId = (obj.payment_intent as string) ?? null;

        if (piId) {
          await supabase
            .from('payments')
            .update({ status: 'disputed' })
            .eq('stripe_payment_intent', piId);
        }

        console.warn('[Stripe Webhook] DISPUTE created:', obj.id);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
