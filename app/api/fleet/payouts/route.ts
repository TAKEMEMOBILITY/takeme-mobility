import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET — list payouts for current owner
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: owner } = await svc.from('fleet_owners').select('id').eq('auth_user_id', user.id).single();
  if (!owner) return NextResponse.json({ error: 'Not a fleet owner' }, { status: 404 });

  const [payouts, bookings] = await Promise.all([
    svc.from('fleet_payouts').select('*').eq('owner_id', owner.id).order('created_at', { ascending: false }).limit(20),
    svc.from('rental_bookings').select('id, total_rental_cents, commission_cents, owner_payout_cents, status, completed_at')
      .eq('owner_id', owner.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(50),
  ]);

  const grossEarnings = (bookings.data ?? []).reduce((s, b) => s + (b.total_rental_cents ?? 0), 0);
  const totalCommission = (bookings.data ?? []).reduce((s, b) => s + (b.commission_cents ?? 0), 0);
  const netPayout = (bookings.data ?? []).reduce((s, b) => s + (b.owner_payout_cents ?? 0), 0);

  return NextResponse.json({
    payouts: payouts.data ?? [],
    summary: { grossEarnings, totalCommission, netPayout, completedBookings: bookings.data?.length ?? 0 },
  });
}
