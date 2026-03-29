import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/driver/card/status
// Returns TAKEME Card status for current driver (no sensitive data)

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const { data: dc } = await supabase
      .from('driver_cards')
      .select('*')
      .eq('driver_id', user.id)
      .maybeSingle();

    if (!dc) {
      return NextResponse.json({ hasCard: false, card: null });
    }

    return NextResponse.json({
      hasCard: true,
      card: {
        id: dc.id,
        cardStatus: dc.card_status,
        shippingStatus: dc.shipping_status,
        hasVirtual: !!dc.stripe_virtual_card_id,
        hasPhysical: !!dc.stripe_physical_card_id,
        hasCardholder: !!dc.stripe_cardholder_id,
        createdAt: dc.created_at,
      },
    });
  } catch (err) {
    console.error('[driver/card/status]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
