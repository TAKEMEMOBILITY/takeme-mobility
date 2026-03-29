import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe';
import { SEATTLE_TIERS, calculateFare, kmToMiles } from '@/lib/seattle-pricing';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/bookings/create
//
// 1. Validates inputs
// 2. Recalculates price server-side (never trusts frontend)
// 3. Inserts booking into Supabase (status: pending)
// 4. Creates Stripe Checkout session
// 5. Returns checkout URL for redirect
// ═══════════════════════════════════════════════════════════════════════════

const requestSchema = z.object({
  pickupAddress: z.string().min(1),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  destinationAddress: z.string().min(1),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  distanceKm: z.number().positive(),
  durationMin: z.number().int().positive(),
  vehicleType: z.enum(['economy', 'comfort', 'premium']),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in to book a ride.' }, { status: 401 });
    }

    // 2. Parse
    let body: z.infer<typeof requestSchema>;
    try {
      body = requestSchema.parse(await request.json());
    } catch (err) {
      const msg = err instanceof z.ZodError
        ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        : 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 3. Server-side price calculation — NEVER trust frontend price
    const tier = SEATTLE_TIERS.find(t => t.id === body.vehicleType);
    if (!tier) {
      return NextResponse.json({ error: 'Invalid vehicle type' }, { status: 400 });
    }

    const fare = calculateFare(tier, body.distanceKm, body.durationMin);
    const distanceMiles = kmToMiles(body.distanceKm);

    // Sanity check
    if (fare.total > 500) {
      return NextResponse.json({ error: 'Fare exceeds maximum. Please try a shorter route.' }, { status: 400 });
    }

    // 4. Insert booking
    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        pickup_address: body.pickupAddress,
        pickup_lat: body.pickupLat,
        pickup_lng: body.pickupLng,
        destination_address: body.destinationAddress,
        destination_lat: body.destinationLat,
        destination_lng: body.destinationLng,
        distance_miles: distanceMiles,
        duration_minutes: body.durationMin,
        vehicle_type: body.vehicleType,
        price: fare.total,
        currency: 'USD',
        status: 'pending',
      })
      .select('id, price')
      .single();

    if (insertError || !booking) {
      console.error('Booking insert failed:', insertError);
      return NextResponse.json({ error: 'Could not create booking. Please try again.' }, { status: 500 });
    }

    // 5. Create Stripe Checkout session
    const origin = request.headers.get('origin') || 'https://takememobility.com';

    const session = await createCheckoutSession({
      rideId: booking.id,
      amount: Math.round(fare.total * 100), // cents
      currency: 'usd',
      customerEmail: user.email ?? undefined,
      successUrl: `${origin}/booking/success?id=${booking.id}`,
      cancelUrl: `${origin}/?cancelled=true`,
    });

    // Save Stripe session ID to booking
    await supabase
      .from('bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', booking.id);

    // 6. Return
    return NextResponse.json({
      bookingId: booking.id,
      price: fare.total,
      checkoutUrl: session.url,
    }, { status: 201 });

  } catch (err) {
    console.error('POST /api/bookings/create failed:', err);
    return NextResponse.json({ error: 'Booking failed. Please try again.' }, { status: 500 });
  }
}
