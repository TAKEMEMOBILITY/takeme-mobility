import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createPhysicalCard } from '@/lib/stripe-issuing';

// POST /api/driver/card/create-physical
// Creates a Stripe Issuing physical card (ships in 2-3 days)

const schema = z.object({
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

    const { data: dc } = await supabase
      .from('driver_cards')
      .select('id, stripe_cardholder_id, stripe_physical_card_id')
      .eq('driver_id', user.id)
      .single();

    if (!dc?.stripe_cardholder_id) {
      return NextResponse.json({ error: 'Create cardholder first' }, { status: 400 });
    }

    if (dc.stripe_physical_card_id) {
      return NextResponse.json({ physicalCardId: dc.stripe_physical_card_id, exists: true });
    }

    const card = await createPhysicalCard(dc.stripe_cardholder_id, user.id, body);

    await supabase.from('driver_cards').update({
      stripe_physical_card_id: card.id,
      shipping_status: 'pending',
    }).eq('id', dc.id);

    return NextResponse.json({
      physicalCardId: card.id,
      last4: card.last4,
      shippingStatus: 'pending',
    }, { status: 201 });
  } catch (err) {
    console.error('[driver/card/create-physical]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
