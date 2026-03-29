import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createVirtualCard } from '@/lib/stripe-issuing';

const schema = z.object({
  cardholderId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = schema.parse(await request.json());

    // Check if virtual card already exists
    const { data: existing } = await supabase
      .from('takeme_cards')
      .select('id, card_number_last4')
      .eq('user_id', user.id)
      .eq('card_type', 'virtual')
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ cardId: existing.id, last4: existing.card_number_last4, exists: true });
    }

    const card = await createVirtualCard(body.cardholderId, user.id);

    // Save to database
    const { data: dbCard, error: insertErr } = await supabase
      .from('takeme_cards')
      .insert({
        user_id: user.id,
        card_number_last4: card.last4,
        card_type: 'virtual',
        status: 'active',
        virtual_ready: true,
        stripe_card_id: card.id,
        stripe_cardholder_id: body.cardholderId,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[card/create-virtual] DB insert failed:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      cardId: dbCard?.id,
      stripeCardId: card.id,
      last4: card.last4,
      status: card.status,
    }, { status: 201 });
  } catch (err) {
    console.error('[card/create-virtual]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
