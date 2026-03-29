import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/connect/subscribe
// Creates a Stripe Checkout session for TAKEME CONNECT ($29.90/mo)
// ═══════════════════════════════════════════════════════════════════════════

const CONNECT_PRICE_CENTS = 2990; // $29.90

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in to subscribe.' }, { status: 401 });
    }

    // Check existing active subscription
    const { data: existing } = await supabase
      .from('driver_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'You already have an active CONNECT plan.' }, { status: 409 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.includes('PASTE')) {
      // No Stripe — create subscription record directly (dev mode)
      const { data: sub, error: subError } = await supabase
        .from('driver_subscriptions')
        .insert({
          user_id: user.id,
          driver_id: user.id,
          plan: 'connect',
          status: 'active',
          price_monthly: 29.90,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();

      if (subError) {
        return NextResponse.json({ error: subError.message }, { status: 500 });
      }

      return NextResponse.json({ subscriptionId: sub?.id, activated: true });
    }

    // Stripe Checkout for subscription
    const origin = request.headers.get('origin') || 'https://takememobility.com';

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(CONNECT_PRICE_CENTS),
        'line_items[0][price_data][recurring][interval]': 'month',
        'line_items[0][price_data][product_data][name]': 'TAKEME CONNECT',
        'line_items[0][price_data][product_data][description]': 'Unlimited data & calls for drivers',
        'line_items[0][quantity]': '1',
        'metadata[user_id]': user.id,
        'metadata[plan]': 'connect',
        'customer_email': user.email || '',
        'success_url': `${origin}/driver/connect/success`,
        'cancel_url': `${origin}/driver/connect`,
      }).toString(),
    });

    const session = await res.json();

    if (!res.ok) {
      console.error('[connect/subscribe] Stripe error:', session);
      return NextResponse.json({ error: 'Payment setup failed.' }, { status: 500 });
    }

    // Create pending subscription record
    await supabase.from('driver_subscriptions').insert({
      user_id: user.id,
      driver_id: user.id,
      plan: 'connect',
      status: 'trialing',
      price_monthly: 29.90,
      stripe_subscription_id: session.subscription || null,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('[connect/subscribe] Error:', err);
    return NextResponse.json({ error: 'Subscription failed.' }, { status: 500 });
  }
}
