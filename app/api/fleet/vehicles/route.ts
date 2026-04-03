import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET — list active vehicles (public for drivers)
export async function GET(request: NextRequest) {
  const svc = createServiceClient();
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');

  let query = svc.from('fleet_vehicles')
    .select('id, make, model, year, color, body_type, seating, range_miles, charging_type, performance_category, pickup_address, daily_rate_cents, weekly_rate_cents, deposit_amount_cents, min_rental_days, min_driver_age, accessories, status')
    .eq('status', 'active')
    .order('daily_rate_cents', { ascending: true });

  if (category) query = query.eq('performance_category', category);
  if (minPrice) query = query.gte('daily_rate_cents', Number(minPrice));
  if (maxPrice) query = query.lte('daily_rate_cents', Number(maxPrice));

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get photos for each vehicle
  const vehicleIds = (data ?? []).map(v => v.id);
  const { data: photos } = vehicleIds.length > 0
    ? await svc.from('vehicle_photos').select('vehicle_id, file_url, photo_type').in('vehicle_id', vehicleIds).order('sort_order')
    : { data: [] };

  const photoMap = new Map<string, string[]>();
  (photos ?? []).forEach(p => {
    if (!photoMap.has(p.vehicle_id)) photoMap.set(p.vehicle_id, []);
    photoMap.get(p.vehicle_id)!.push(p.file_url);
  });

  const enriched = (data ?? []).map(v => ({ ...v, photos: photoMap.get(v.id) ?? [] }));
  return NextResponse.json(enriched);
}

// POST — create vehicle (fleet owner only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: owner } = await svc.from('fleet_owners').select('id, status').eq('auth_user_id', user.id).single();
  if (!owner) return NextResponse.json({ error: 'Not a fleet owner' }, { status: 403 });

  const body = await request.json();
  const { data: vehicle, error } = await svc.from('fleet_vehicles').insert({
    owner_id: owner.id,
    make: body.make,
    model: body.model,
    year: body.year,
    color: body.color ?? null,
    body_type: body.bodyType ?? null,
    vin: body.vin ?? null,
    plate: body.plate ?? null,
    seating: body.seating ?? 5,
    range_miles: body.rangeMiles ?? null,
    charging_type: body.chargingType ?? null,
    performance_category: body.performanceCategory ?? 'standard',
    pickup_address: body.pickupAddress ?? null,
    pickup_instructions: body.pickupInstructions ?? null,
    daily_rate_cents: body.dailyRateCents,
    weekly_rate_cents: body.weeklyRateCents ?? null,
    deposit_amount_cents: body.depositAmountCents ?? 0,
    min_rental_days: body.minRentalDays ?? 1,
    min_driver_age: body.minDriverAge ?? 21,
    accessories: body.accessories ?? [],
    owner_notes: body.ownerNotes ?? null,
    status: 'pending_documents',
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicleId: vehicle!.id });
}
