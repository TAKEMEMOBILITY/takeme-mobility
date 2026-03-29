import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createCardholder } from '@/lib/stripe-issuing';

// POST /api/driver/cardholder/create
// Creates a Stripe Issuing cardholder for an approved driver

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  line1: z.string().default('1 TakeMe Way'),
  city: z.string().default('Seattle'),
  state: z.string().default('WA'),
  postalCode: z.string().default('98101'),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = schema.parse(await request.json());

    // Check existing
    const { data: existing } = await supabase
      .from('driver_cards')
      .select('id, stripe_cardholder_id')
      .eq('driver_id', user.id)
      .maybeSingle();

    if (existing?.stripe_cardholder_id) {
      return NextResponse.json({ cardholderId: existing.stripe_cardholder_id, exists: true });
    }

    const ch = await createCardholder({
      name: body.name,
      email: body.email || user.email || '',
      phone: body.phone,
      userId: user.id,
      line1: body.line1,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
    });

    // Upsert driver_cards row
    if (existing) {
      await supabase.from('driver_cards').update({ stripe_cardholder_id: ch.id }).eq('id', existing.id);
    } else {
      await supabase.from('driver_cards').insert({
        driver_id: user.id,
        stripe_cardholder_id: ch.id,
        card_status: 'cardholder_created',
      });
    }

    return NextResponse.json({ cardholderId: ch.id, status: ch.status }, { status: 201 });
  } catch (err) {
    console.error('[driver/cardholder/create]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
