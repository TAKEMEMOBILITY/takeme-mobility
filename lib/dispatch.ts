// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — Dispatch Service
// Finds nearby drivers and assigns them to rides.
// Runs server-side only with service role (bypasses RLS).
// ═══════════════════════════════════════════════════════════════════════════

import { createServiceClient } from '@/lib/supabase/service';

export interface NearbyDriver {
  driver_id: string;
  driver_name: string;
  driver_rating: number;
  vehicle_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  plate_number: string;
  distance_m: number;
  heading: number | null;
  lat: number;
  lng: number;
}

export interface AssignmentResult {
  success: boolean;
  driver: NearbyDriver | null;
  error?: string;
}

/**
 * Find available drivers near a pickup point.
 */
export async function findNearbyDrivers(
  pickupLat: number,
  pickupLng: number,
  vehicleClass: 'economy' | 'comfort' | 'premium',
  radiusMeters = 5000,
  limit = 10,
): Promise<NearbyDriver[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('find_nearby_drivers', {
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    search_radius_m: radiusMeters,
    ride_vehicle_class: vehicleClass,
    max_results: limit,
  });

  if (error) {
    console.error('find_nearby_drivers RPC failed:', error.message);
    return [];
  }

  return (data as NearbyDriver[]) ?? [];
}

/**
 * Assign the nearest available driver to a ride.
 * Updates ride status to driver_assigned and driver status to busy.
 * Returns the assigned driver or null if none available.
 */
export async function assignDriver(rideId: string): Promise<AssignmentResult> {
  const supabase = createServiceClient();

  // 1. Fetch ride details
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select('id, pickup_lat, pickup_lng, vehicle_class, status')
    .eq('id', rideId)
    .single();

  if (rideError || !ride) {
    return { success: false, driver: null, error: 'Ride not found' };
  }

  if (ride.status !== 'searching_driver') {
    return { success: false, driver: null, error: `Ride is in status ${ride.status}, not searching_driver` };
  }

  // 2. Find nearby drivers (expanding radius if needed)
  let drivers: NearbyDriver[] = [];
  const radii = [3000, 5000, 10000]; // 3km, 5km, 10km

  for (const radius of radii) {
    drivers = await findNearbyDrivers(
      ride.pickup_lat,
      ride.pickup_lng,
      ride.vehicle_class,
      radius,
    );
    if (drivers.length > 0) break;
  }

  if (drivers.length === 0) {
    return { success: false, driver: null, error: 'No drivers available nearby' };
  }

  // 3. Pick the nearest driver
  const nearest = drivers[0];

  // 4. Assign — update ride and driver atomically
  const now = new Date().toISOString();

  const { error: assignError } = await supabase
    .from('rides')
    .update({
      assigned_driver_id: nearest.driver_id,
      vehicle_id: nearest.vehicle_id,
      status: 'driver_assigned',
      driver_assigned_at: now,
    })
    .eq('id', rideId)
    .eq('status', 'searching_driver'); // optimistic lock

  if (assignError) {
    console.error('Ride assignment failed:', assignError.message);
    return { success: false, driver: null, error: 'Assignment failed' };
  }

  // 5. Set driver status to busy
  await supabase
    .from('drivers')
    .update({ status: 'busy' })
    .eq('id', nearest.driver_id)
    .eq('status', 'available'); // only if still available

  // 6. Log the assignment event
  await supabase.from('ride_events').insert({
    ride_id: rideId,
    event_type: 'driver_assigned',
    new_status: 'driver_assigned',
    old_status: 'searching_driver',
    actor: 'system',
    metadata: {
      driver_id: nearest.driver_id,
      driver_name: nearest.driver_name,
      vehicle: `${nearest.vehicle_make} ${nearest.vehicle_model}`,
      plate: nearest.plate_number,
      distance_m: nearest.distance_m,
    },
  });

  return { success: true, driver: nearest };
}
