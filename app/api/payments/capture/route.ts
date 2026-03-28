import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { capturePaymentIntent } from '@/lib/stripe';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/payments/capture
//
// Captures an authorized PaymentIntent after ride completion.
// Optionally adjusts the capture amount if the final fare differs
// from the estimated fare (e.g., route change, wait time).
// ═══════════════════════════════════════════════════════════════════════════

const requestSchema = z.object({
  rideId: z.string().uuid(),
  finalFare: z.number().positive().optional(),  // override amount if fare changed
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse
    let body: z.infer<typeof requestSchema>;
    try {
      body = requestSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // 3. Fetch ride + payment
    const { data: ride } = await supabase
      .from('rides')
      .select('id, rider_id, estimated_fare, status')
      .eq('id', body.rideId)
      .single();

    if (!ride || ride.rider_id !== user.id) {
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('id, stripe_payment_intent, status, amount')
      .eq('ride_id', body.rideId)
      .eq('status', 'authorized')
      .single();

    if (!payment?.stripe_payment_intent) {
      return NextResponse.json({ error: 'No authorized payment found for this ride' }, { status: 400 });
    }

    // 4. Capture
    const finalAmount = body.finalFare ?? ride.estimated_fare;
    const amountCents = Math.round(finalAmount * 100);

    const result = await capturePaymentIntent(payment.stripe_payment_intent, amountCents);

    // 5. Update payment record
    await supabase
      .from('payments')
      .update({
        status: 'captured',
        amount: finalAmount,
        captured_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    // 6. Update ride with final fare
    await supabase
      .from('rides')
      .update({
        final_fare: finalAmount,
        status: 'completed',
        trip_completed_at: new Date().toISOString(),
      })
      .eq('id', body.rideId);

    return NextResponse.json({
      captured: true,
      paymentIntentId: result.id,
      finalFare: finalAmount,
    });
  } catch (err) {
    console.error('POST /api/payments/capture failed:', err);
    const msg = err instanceof Error ? err.message : 'Capture failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
