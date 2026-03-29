import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/card/fund
//
// Transfers funds from driver's available balance to their TAKEME Card.
// In production, this triggers a Stripe top-up to Issuing balance.
// For MVP, we track the transfer in our DB.
// ═══════════════════════════════════════════════════════════════════════════

const schema = z.object({
  amount: z.number().positive().max(5000),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = schema.parse(await request.json());
    const svc = createServiceClient();

    // Get current balance
    const { data: balance } = await svc
      .from('driver_balances')
      .select('available, card_balance')
      .eq('driver_id', user.id)
      .single();

    if (!balance) {
      // Create balance record if it doesn't exist
      await svc.from('driver_balances').insert({
        driver_id: user.id,
        available: 0,
        card_balance: 0,
      });
      return NextResponse.json({ error: 'No available balance to transfer.' }, { status: 400 });
    }

    if (balance.available < body.amount) {
      return NextResponse.json({
        error: `Insufficient balance. Available: $${Number(balance.available).toFixed(2)}`,
      }, { status: 400 });
    }

    // Transfer: deduct from available, add to card_balance
    const newAvailable = Number(balance.available) - body.amount;
    const newCardBalance = Number(balance.card_balance) + body.amount;

    const { error: updateErr } = await svc
      .from('driver_balances')
      .update({
        available: newAvailable,
        card_balance: newCardBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('driver_id', user.id);

    if (updateErr) {
      console.error('[card/fund] Balance update failed:', updateErr);
      return NextResponse.json({ error: 'Transfer failed.' }, { status: 500 });
    }

    // Log the transfer
    await svc.from('card_funding_log').insert({
      driver_id: user.id,
      amount: body.amount,
      direction: 'to_card',
      status: 'completed',
    });

    // In production: trigger Stripe top-up here
    // const topup = await createTopUp(Math.round(body.amount * 100), `TAKEME Card fund - ${user.id}`);

    return NextResponse.json({
      funded: true,
      amount: body.amount,
      newAvailable: newAvailable,
      newCardBalance: newCardBalance,
    });
  } catch (err) {
    console.error('[card/fund]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Transfer failed',
    }, { status: 500 });
  }
}
