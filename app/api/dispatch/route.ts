import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assignDriver } from '@/lib/dispatch';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/dispatch
// Trigger driver assignment for a ride.
// Called after ride creation or can be retried if no driver found initially.
// ═══════════════════════════════════════════════════════════════════════════

const requestSchema = z.object({
  rideId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate (rider must own the ride)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = requestSchema.parse(await request.json());

    // 2. Verify ride ownership
    const { data: ride } = await supabase
      .from('rides')
      .select('id, rider_id, status')
      .eq('id', body.rideId)
      .single();

    if (!ride || ride.rider_id !== user.id) {
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }

    if (ride.status !== 'searching_driver') {
      return NextResponse.json({
        error: `Ride is ${ride.status}, not searching for a driver`,
      }, { status: 400 });
    }

    // 3. Attempt assignment
    const result = await assignDriver(body.rideId);

    if (!result.success) {
      return NextResponse.json({
        assigned: false,
        error: result.error,
      });
    }

    return NextResponse.json({
      assigned: true,
      driver: {
        id: result.driver!.driver_id,
        name: result.driver!.driver_name,
        rating: result.driver!.driver_rating,
        vehicle: `${result.driver!.vehicle_make} ${result.driver!.vehicle_model}`,
        color: result.driver!.vehicle_color,
        plate: result.driver!.plate_number,
        distanceMeters: Math.round(result.driver!.distance_m),
        lat: result.driver!.lat,
        lng: result.driver!.lng,
      },
    });
  } catch (err) {
    console.error('POST /api/dispatch failed:', err);
    return NextResponse.json({ error: 'Dispatch failed' }, { status: 500 });
  }
}
