import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isIssuingEnabled } from '@/lib/stripe-issuing';

// GET /api/driver/card/status
// Returns full TAKEME Card details for driver app display

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const svc = createServiceClient();

    const { data: dc } = await svc
      .from('driver_cards')
      .select('*')
      .eq('driver_id', user.id)
      .maybeSingle();

    if (!dc) {
      return NextResponse.json({
        hasCard: false,
        issuingEnabled: isIssuingEnabled(),
        card: null,
        balance: null,
      });
    }

    // Get balance info
    const { data: balance } = await svc
      .from('driver_balances')
      .select('available, card_balance')
      .eq('driver_id', user.id)
      .maybeSingle();

    // Get recent card transactions
    const { data: txns } = await svc
      .from('card_transactions')
      .select('id, type, amount, description, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      hasCard: true,
      issuingEnabled: isIssuingEnabled(),
      card: {
        id: dc.id,
        cardStatus: dc.card_status,
        shippingStatus: dc.shipping_status,
        hasVirtual: !!dc.stripe_virtual_card_id,
        hasPhysical: !!dc.stripe_physical_card_id,
        createdAt: dc.created_at,
        spendingLimits: {
          daily: 500,
          monthly: 5000,
          perTransaction: 200,
        },
      },
      balance: balance ? {
        available: Number(balance.available),
        cardBalance: Number(balance.card_balance),
      } : null,
      recentTransactions: txns ?? [],
    });
  } catch (err) {
    console.error('[driver/card/status]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
