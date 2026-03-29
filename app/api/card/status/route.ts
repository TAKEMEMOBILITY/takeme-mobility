import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/card/status — returns card info for the current user

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const { data: cards } = await supabase
      .from('takeme_cards')
      .select('id, card_number_last4, card_type, status, virtual_ready, physical_status, wallet_added, balance, total_cashback, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    const virtual = cards?.find((c: { card_type: string }) => c.card_type === 'virtual') ?? null;
    const physical = cards?.find((c: { card_type: string }) => c.card_type === 'physical') ?? null;

    return NextResponse.json({
      hasCard: !!virtual,
      virtual: virtual ? {
        id: virtual.id,
        last4: virtual.card_number_last4,
        status: virtual.status,
        ready: virtual.virtual_ready,
        walletAdded: virtual.wallet_added,
        balance: virtual.balance,
        cashback: virtual.total_cashback,
      } : null,
      physical: physical ? {
        id: physical.id,
        last4: physical.card_number_last4,
        status: physical.physical_status,
      } : null,
    });
  } catch (err) {
    console.error('[card/status]', err);
    return NextResponse.json({ error: 'Failed to load card status' }, { status: 500 });
  }
}
