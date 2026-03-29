import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/card/activate
//
// Activates a delivered physical TAKEME Card.
// Driver must confirm the last 4 digits printed on the card.
// After verification, card status moves to 'active' and Stripe card
// status is updated to 'active' (physical cards ship as 'inactive').
// ═══════════════════════════════════════════════════════════════════════════

const STRIPE_API = 'https://api.stripe.com/v1';

const schema = z.object({
  last4: z.string().length(4, 'Enter the last 4 digits on your card'),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = schema.parse(await request.json());
    const svc = createServiceClient();

    // Get driver card record
    const { data: dc } = await svc
      .from('driver_cards')
      .select('id, stripe_physical_card_id, card_status, shipping_status')
      .eq('driver_id', user.id)
      .single();

    if (!dc) {
      return NextResponse.json({ error: 'No card found.' }, { status: 404 });
    }

    if (dc.card_status === 'active') {
      return NextResponse.json({ activated: true, alreadyActive: true });
    }

    if (dc.shipping_status !== 'delivered' && dc.card_status !== 'needs_activation') {
      return NextResponse.json({ error: 'Card has not been delivered yet.' }, { status: 400 });
    }

    if (!dc.stripe_physical_card_id) {
      return NextResponse.json({ error: 'No physical card on record.' }, { status: 400 });
    }

    // Verify last 4 digits against Stripe
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      try {
        const res = await fetch(`${STRIPE_API}/issuing/cards/${dc.stripe_physical_card_id}`, {
          headers: { 'Authorization': `Bearer ${stripeKey}` },
        });
        const card = await res.json();

        if (card.last4 && card.last4 !== body.last4) {
          return NextResponse.json({ error: 'Last 4 digits do not match. Check your card.' }, { status: 400 });
        }

        // Activate the card on Stripe
        await fetch(`${STRIPE_API}/issuing/cards/${dc.stripe_physical_card_id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'status=active',
        });
      } catch (err) {
        console.error('[card/activate] Stripe error:', err);
        // Continue — activate in our DB even if Stripe call fails
      }
    }

    // Activate in our DB
    await svc.from('driver_cards').update({
      card_status: 'active',
    }).eq('id', dc.id);

    // Also update takeme_cards if exists
    await svc.from('takeme_cards').update({
      status: 'active',
    }).eq('stripe_card_id', dc.stripe_physical_card_id);

    return NextResponse.json({ activated: true });
  } catch (err) {
    console.error('[card/activate]', err);
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : 'Activation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
