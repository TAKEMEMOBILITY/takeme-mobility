import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createCardholder } from '@/lib/stripe-issuing';

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = schema.parse(await request.json());

    // Check if cardholder already exists
    const { data: existing } = await supabase
      .from('takeme_cards')
      .select('stripe_cardholder_id')
      .eq('user_id', user.id)
      .not('stripe_cardholder_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (existing?.stripe_cardholder_id) {
      return NextResponse.json({ cardholderId: existing.stripe_cardholder_id, exists: true });
    }

    const cardholder = await createCardholder({
      name: body.name,
      email: body.email || user.email || '',
      phone: body.phone,
      userId: user.id,
      line1: body.line1,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
    });

    return NextResponse.json({ cardholderId: cardholder.id, status: cardholder.status }, { status: 201 });
  } catch (err) {
    console.error('[card/create-cardholder]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
