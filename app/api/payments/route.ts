import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { findOrCreateCustomer, createPaymentIntent } from '@/lib/stripe';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/payments
//
// Creates a PaymentIntent for a ride. Ensures the rider has a Stripe
// customer, creates the intent with manual capture (authorize now, capture
// after ride completes), and writes a payment record to the database.
// ═══════════════════════════════════════════════════════════════════════════

const requestSchema = z.object({
  rideId: z.string().uuid(),
  savedPaymentMethodId: z.string().optional(),  // pm_xxx if using saved card
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    }

    // 2. Parse request
    let body: z.infer<typeof requestSchema>;
    try {
      const raw = await request.json();
      body = requestSchema.parse(raw);
    } catch (err) {
      const msg = err instanceof z.ZodError
        ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        : 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 3. Fetch the ride and verify ownership
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('id, rider_id, estimated_fare, currency, status, pickup_address, dropoff_address, vehicle_class')
      .eq('id', body.rideId)
      .single();

    if (rideError || !ride) {
      return NextResponse.json({ error: 'Ride not found.' }, { status: 404 });
    }

    if (ride.rider_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    if (ride.status === 'cancelled') {
      return NextResponse.json({ error: 'This ride has been cancelled.' }, { status: 400 });
    }

    // 4. Ensure Stripe customer exists
    const { data: rider } = await supabase
      .from('riders')
      .select('stripe_customer_id, full_name, email')
      .eq('id', user.id)
      .single();

    let customerId = rider?.stripe_customer_id;

    if (!customerId) {
      customerId = await findOrCreateCustomer(
        user.email ?? rider?.email ?? '',
        rider?.full_name ?? undefined,
        user.id,
      );

      // Save customer ID to rider profile
      await supabase
        .from('riders')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // 5. Create PaymentIntent (manual capture — authorize now, capture later)
    const amountCents = Math.round(ride.estimated_fare * 100);

    const intent = await createPaymentIntent({
      amount: amountCents,
      currency: ride.currency ?? 'usd',
      customerId,
      rideId: ride.id,
      description: `TakeMe ${ride.vehicle_class} ride: ${ride.pickup_address} → ${ride.dropoff_address}`,
      savedPaymentMethodId: body.savedPaymentMethodId,
    });

    // 6. Create payment record in database
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        ride_id: ride.id,
        rider_id: user.id,
        stripe_payment_intent: intent.id,
        payment_method_type: body.savedPaymentMethodId ? 'saved_card' : 'new',
        amount: ride.estimated_fare,
        currency: ride.currency ?? 'USD',
        status: 'pending',
      });

    if (paymentError) {
      console.warn('Payment record insert failed (non-fatal):', paymentError.message);
    }

    // 7. Return client secret for Stripe Elements
    return NextResponse.json({
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.id,
      customerId,
    });
  } catch (err) {
    console.error('POST /api/payments failed:', err);
    const msg = err instanceof Error ? err.message : 'Payment setup failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
