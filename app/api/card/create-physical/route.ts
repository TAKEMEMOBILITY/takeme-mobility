import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createPhysicalCard } from '@/lib/stripe-issuing';

const schema = z.object({
  cardholderId: z.string().min(1),
  name: z.string().min(2),
  line1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2),
  postalCode: z.string().min(5),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = schema.parse(await request.json());

    // Check if physical card already exists
    const { data: existing } = await supabase
      .from('takeme_cards')
      .select('id, physical_status')
      .eq('user_id', user.id)
      .eq('card_type', 'physical')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ cardId: existing.id, physicalStatus: existing.physical_status, exists: true });
    }

    const card = await createPhysicalCard(body.cardholderId, user.id, {
      name: body.name,
      line1: body.line1,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
    });

    // Save to database
    const { data: dbCard, error: insertErr } = await supabase
      .from('takeme_cards')
      .insert({
        user_id: user.id,
        card_number_last4: card.last4,
        card_type: 'physical',
        status: 'pending',
        virtual_ready: false,
        physical_status: 'ordered',
        physical_ordered_at: new Date().toISOString(),
        stripe_card_id: card.id,
        stripe_cardholder_id: body.cardholderId,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[card/create-physical] DB insert failed:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      cardId: dbCard?.id,
      stripeCardId: card.id,
      last4: card.last4,
      physicalStatus: 'ordered',
    }, { status: 201 });
  } catch (err) {
    console.error('[card/create-physical]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
