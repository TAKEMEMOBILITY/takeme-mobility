import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordPickup, recordReturn } from '@/lib/fleet/handoffs';
import { createServiceClient } from '@/lib/supabase/service';

// POST — record pickup or return
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const data = {
    bookingId: body.bookingId,
    batteryPct: body.batteryPct ?? 0,
    odometer: body.odometer ?? 0,
    exteriorCondition: body.exteriorCondition ?? 'good',
    interiorCondition: body.interiorCondition ?? 'good',
    accessoriesPresent: body.accessoriesPresent ?? [],
    photos: body.photos ?? [],
    notes: body.notes,
  };

  if (body.type === 'pickup') {
    const result = await recordPickup(data, user.id);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.type === 'return') {
    // Get scheduled end date
    const svc = createServiceClient();
    const { data: booking } = await svc.from('rental_bookings').select('end_date').eq('id', body.bookingId).single();
    const result = await recordReturn(data, user.id, booking?.end_date ?? new Date().toISOString());
    if (!result.success) return NextResponse.json({ error: 'Return failed' }, { status: 400 });
    return NextResponse.json({ ok: true, fees: result.fees });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
