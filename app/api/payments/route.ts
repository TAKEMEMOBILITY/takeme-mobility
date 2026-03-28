import { NextRequest, NextResponse } from 'next/server';

// Uses Stripe REST API directly via fetch — no 'stripe' npm package import.
// This eliminates all ESM/CJS/Turbopack bundling issues that cause the route
// to hang or crash and return HTML instead of JSON.

export async function POST(request: NextRequest) {
  try {
    // 1. Validate the secret key
    const secretKey = process.env.STRIPE_SECRET_KEY ?? '';

    if (!secretKey || secretKey.includes('PASTE_YOUR') || secretKey.includes('REPLACE_WITH')) {
      console.error('Stripe: STRIPE_SECRET_KEY is not set');
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY is not set. Add sk_test_... to .env.local and restart.' },
        { status: 500 },
      );
    }

    if (secretKey.startsWith('sk_live_')) {
      console.error('Stripe: using LIVE key in development');
      return NextResponse.json(
        { error: 'Using live key in development. Switch to sk_test_... in .env.local.' },
        { status: 500 },
      );
    }

    // 2. Parse the request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const amount = typeof body.amount === 'number' ? body.amount : 0;
    const tripId = typeof body.tripId === 'string' ? body.tripId : '';
    const currency = typeof body.currency === 'string' ? body.currency : 'usd';

    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!tripId) {
      return NextResponse.json({ error: 'Invalid tripId' }, { status: 400 });
    }

    // 3. Create PaymentIntent via Stripe REST API
    const amountInCents = Math.round(amount * 100);

    console.log('Creating PaymentIntent:', { amountInCents, currency, tripId });

    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'amount': String(amountInCents),
        'currency': currency,
        'automatic_payment_methods[enabled]': 'true',
        'metadata[tripId]': tripId,
      }).toString(),
    });

    const stripeData = await stripeRes.json();

    if (!stripeRes.ok) {
      const errMsg = stripeData?.error?.message || `Stripe API error (${stripeRes.status})`;
      console.error('Stripe API error:', stripeData?.error);
      return NextResponse.json({ error: errMsg }, { status: stripeRes.status });
    }

    const clientSecret = stripeData.client_secret;
    if (!clientSecret) {
      console.error('Stripe returned no client_secret:', stripeData);
      return NextResponse.json({ error: 'Stripe returned no client_secret' }, { status: 500 });
    }

    console.log('PaymentIntent created:', stripeData.id);

    return NextResponse.json({ clientSecret });
  } catch (error: unknown) {
    console.error('Stripe error:', error);
    const message = error instanceof Error ? error.message : 'Payment creation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
