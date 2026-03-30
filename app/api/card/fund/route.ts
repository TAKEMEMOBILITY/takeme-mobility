import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/card/fund
//
// Transfers funds from driver's available balance to their TAKEME Card.
// Uses atomic RPC to prevent race conditions on concurrent requests.
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

    // Atomic transfer via RPC — prevents read-then-write race condition
    const { data, error: rpcError } = await svc.rpc('transfer_to_card', {
      p_driver_id: user.id,
      p_amount: body.amount,
    });

    if (rpcError) {
      console.error('[card/fund] Transfer RPC failed:', rpcError);
      return NextResponse.json({ error: 'Transfer failed.' }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; available?: number; card_balance?: number };
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Insufficient balance.' }, { status: 400 });
    }

    // Log the transfer
    await svc.from('card_funding_log').insert({
      driver_id: user.id,
      amount: body.amount,
      direction: 'to_card',
      status: 'completed',
    });

    return NextResponse.json({
      funded: true,
      amount: body.amount,
      newAvailable: result.available,
      newCardBalance: result.card_balance,
    });
  } catch (err) {
    console.error('[card/fund]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Transfer failed',
    }, { status: 500 });
  }
}
