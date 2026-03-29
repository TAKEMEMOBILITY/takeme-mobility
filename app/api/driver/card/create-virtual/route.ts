import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createVirtualCard } from '@/lib/stripe-issuing';

// POST /api/driver/card/create-virtual
// Creates a Stripe Issuing virtual card (instant use)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    // Get driver card record
    const { data: dc } = await supabase
      .from('driver_cards')
      .select('id, stripe_cardholder_id, stripe_virtual_card_id')
      .eq('driver_id', user.id)
      .single();

    if (!dc?.stripe_cardholder_id) {
      return NextResponse.json({ error: 'Create cardholder first' }, { status: 400 });
    }

    if (dc.stripe_virtual_card_id) {
      return NextResponse.json({ virtualCardId: dc.stripe_virtual_card_id, exists: true });
    }

    const card = await createVirtualCard(dc.stripe_cardholder_id, user.id);

    await supabase.from('driver_cards').update({
      stripe_virtual_card_id: card.id,
      card_status: 'virtual_ready',
    }).eq('id', dc.id);

    return NextResponse.json({
      virtualCardId: card.id,
      last4: card.last4,
      status: 'virtual_ready',
    }, { status: 201 });
  } catch (err) {
    console.error('[driver/card/create-virtual]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
