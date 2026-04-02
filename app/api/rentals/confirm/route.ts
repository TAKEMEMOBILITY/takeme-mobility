import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const STRIPE_API = 'https://api.stripe.com/v1';

function getStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key || key.includes('PASTE_YOUR')) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return key;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rentalId } = await request.json();

    if (!rentalId) {
      return NextResponse.json({ error: 'Missing rentalId' }, { status: 400 });
    }

    const svc = createServiceClient();

    // Look up the rental and verify ownership
    const { data: rental, error: fetchError } = await svc
      .from('rentals')
      .select('id, user_id, status, stripe_payment_intent, confirmation_code')
      .eq('id', rentalId)
      .single();

    if (fetchError || !rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    if (rental.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (rental.status !== 'pending') {
      return NextResponse.json(
        { error: `Rental is already ${rental.status}` },
        { status: 409 },
      );
    }

    if (!rental.stripe_payment_intent) {
      return NextResponse.json(
        { error: 'No payment intent associated with this rental' },
        { status: 400 },
      );
    }

    // Verify the Stripe PaymentIntent status
    const stripeKey = getStripeKey();
    const piRes = await fetch(
      `${STRIPE_API}/payment_intents/${rental.stripe_payment_intent}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      },
    );

    const piData = await piRes.json();
    if (!piRes.ok) {
      const msg = piData?.error?.message || `Stripe error ${piRes.status}`;
      throw new Error(msg);
    }

    if (piData.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment not completed. Current status: ${piData.status}` },
        { status: 402 },
      );
    }

    // Update rental status to confirmed
    const { error: updateError } = await svc
      .from('rentals')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', rentalId);

    if (updateError) {
      console.error('[rentals/confirm] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to confirm rental' }, { status: 500 });
    }

    return NextResponse.json({
      confirmed: true,
      confirmationCode: rental.confirmation_code,
    });
  } catch (err) {
    console.error('[rentals/confirm]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Confirmation failed' },
      { status: 500 },
    );
  }
}
