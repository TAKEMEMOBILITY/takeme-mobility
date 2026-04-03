import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createRentalBooking, transitionBookingStatus } from '@/lib/fleet/bookings';

// POST — create rental booking (one-click flow)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const result = await createRentalBooking({
    vehicleId: body.vehicleId,
    driverId: user.id,
    startDate: body.startDate,
    endDate: body.endDate,
    idempotencyKey: body.idempotencyKey,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error, eligibility: result.eligibility }, { status: 400 });
  }

  return NextResponse.json({ bookingId: result.bookingId });
}

// GET — list driver's bookings
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data } = await svc
    .from('rental_bookings')
    .select('*, fleet_vehicles(make, model, year, color, pickup_address)')
    .eq('driver_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(data ?? []);
}

// PATCH — transition booking status
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { bookingId, status, reason } = await request.json();
  const result = await transitionBookingStatus(bookingId, status, user.id, reason);

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
