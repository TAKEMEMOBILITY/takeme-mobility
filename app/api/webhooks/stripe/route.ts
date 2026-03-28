import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/webhooks/stripe
//
// Handles Stripe webhook events. Uses the service role key to bypass RLS.
//
// Events handled:
//   payment_intent.amount_capturable_updated — authorization successful
//   payment_intent.succeeded                 — capture complete
//   payment_intent.payment_failed            — payment failed
//   charge.refunded                          — refund processed
//   charge.dispute.created                   — dispute opened
// ═══════════════════════════════════════════════════════════════════════════

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

        // Verify the payment exists in our database before updating
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id, rider_id, amount')
          .eq('stripe_payment_intent', piId)
          .single();

        if (!existingPayment) {
          console.warn(`[Webhook] Unknown PaymentIntent: ${piId}`);
          break;
        }

        // Verify authorized amount matches expected (within 1% tolerance)
        const authorizedAmountCents = obj.amount_capturable as number ?? obj.amount as number ?? 0;
        const expectedCents = Math.round(existingPayment.amount * 100);
        if (Math.abs(authorizedAmountCents - expectedCents) > expectedCents * 0.01) {
          console.error(`[Webhook] Amount mismatch for ${piId}: authorized=${authorizedAmountCents}, expected=${expectedCents}`);
          // Still update but flag it
        }

        await supabase
          .from('payments')
          .update({
            status: 'authorized',
            authorized_at: new Date().toISOString(),
          })
          .eq('id', existingPayment.id);

        // Save the payment method for future rides
        const pmId = obj.payment_method as string | null;
        if (pmId && existingPayment.rider_id) {
          await supabase
            .from('riders')
            .update({ default_payment_method: pmId })
            .eq('id', existingPayment.rider_id);

          await supabase
            .from('payments')
            .update({ payment_method_type: 'card' })
            .eq('id', existingPayment.id);
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
