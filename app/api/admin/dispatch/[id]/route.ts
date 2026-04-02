import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getExcludedDrivers, getDriverOffer } from '@/lib/redis';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: rideId } = await params;
  const svc = createServiceClient();

  // Fetch ride details
  const { data: ride, error: rideErr } = await svc
    .from('rides')
    .select('id, rider_id, assigned_driver_id, status, pickup_address, dropoff_address, pickup_lat, pickup_lng, estimated_fare, final_fare, surge_multiplier, cancel_reason, cancelled_by, requested_at, trip_completed_at')
    .eq('id', rideId)
    .single();

  if (rideErr || !ride) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
  }

  // Fetch assigned driver info if applicable
  let assignedDriver = null;
  if (ride.assigned_driver_id) {
    const { data } = await svc
      .from('drivers')
      .select('id, full_name, email, phone, status, rating, total_trips')
      .eq('id', ride.assigned_driver_id)
      .single();
    assignedDriver = data;
  }

  // Fetch dispatch-related ride events
  const { data: events } = await svc
    .from('ride_events')
    .select('id, event_type, old_status, new_status, actor, metadata, created_at')
    .eq('ride_id', rideId)
    .or('event_type.ilike.%dispatch%,event_type.ilike.%assign%,event_type.ilike.%offer%,event_type.ilike.%timeout%,event_type.ilike.%escalat%')
    .order('created_at', { ascending: true });

  // Fetch all events for the timeline
  const { data: allEvents } = await svc
    .from('ride_events')
    .select('id, event_type, old_status, new_status, actor, metadata, created_at')
    .eq('ride_id', rideId)
    .order('created_at', { ascending: true });

  // Get Redis dispatch state
  let excludedDrivers: string[] = [];
  let currentOffer: string | null = null;

  try {
    excludedDrivers = await getExcludedDrivers(rideId);
  } catch {
    // Redis may be unavailable
  }

  try {
    currentOffer = await getDriverOffer(rideId);
  } catch {
    // Redis may be unavailable
  }

  // Fetch excluded driver details
  let excludedDriverDetails: Array<{ id: string; full_name: string; email: string }> = [];
  if (excludedDrivers.length > 0) {
    const { data } = await svc
      .from('drivers')
      .select('id, full_name, email')
      .in('id', excludedDrivers);
    excludedDriverDetails = data ?? [];
  }

  // Find nearby available drivers (within 10km of pickup)
  let nearbyDrivers: Array<{
    id: string;
    full_name: string;
    status: string;
    rating: number;
    distance_km: number;
    lat: number;
    lng: number;
  }> = [];

  if (ride.pickup_lat && ride.pickup_lng) {
    // Query driver_locations joined with drivers for available drivers
    // Using Haversine approximation in SQL via PostGIS or manual calculation
    const { data: nearby } = await svc.rpc('nearby_available_drivers', {
      p_lat: ride.pickup_lat,
      p_lng: ride.pickup_lng,
      p_radius_km: 10,
      p_limit: 20,
    });

    if (nearby) {
      nearbyDrivers = nearby;
    } else {
      // Fallback: query driver_locations table directly
      const { data: locations } = await svc
        .from('driver_locations')
        .select('driver_id, lat, lng, updated_at')
        .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

      if (locations && locations.length > 0) {
        // Get the drivers who are available
        const driverIds = locations.map((l: { driver_id: string }) => l.driver_id);
        const { data: drivers } = await svc
          .from('drivers')
          .select('id, full_name, status, rating')
          .in('id', driverIds)
          .eq('status', 'available');

        if (drivers) {
          const driverMap = new Map(drivers.map((d: { id: string; full_name: string; status: string; rating: number }) => [d.id, d]));

          nearbyDrivers = locations
            .filter((l: { driver_id: string }) => driverMap.has(l.driver_id))
            .map((l: { driver_id: string; lat: number; lng: number }) => {
              const d = driverMap.get(l.driver_id)!;
              const R = 6371;
              const dLat = ((l.lat - ride.pickup_lat) * Math.PI) / 180;
              const dLng = ((l.lng - ride.pickup_lng) * Math.PI) / 180;
              const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos((ride.pickup_lat * Math.PI) / 180) *
                  Math.cos((l.lat * Math.PI) / 180) *
                  Math.sin(dLng / 2) ** 2;
              const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              return {
                id: d.id,
                full_name: d.full_name,
                status: d.status,
                rating: d.rating,
                distance_km: Math.round(dist * 100) / 100,
                lat: l.lat,
                lng: l.lng,
              };
            })
            .filter((d: { distance_km: number }) => d.distance_km <= 10)
            .sort((a: { distance_km: number }, b: { distance_km: number }) => a.distance_km - b.distance_km)
            .slice(0, 20);
        }
      }
    }
  }

  // Compute escalation count from events
  const escalationCount = (events ?? []).filter(
    (e: { event_type: string }) =>
      e.event_type.includes('escalat') || e.event_type.includes('timeout'),
  ).length;

  return NextResponse.json({
    ride,
    assignedDriver,
    dispatchEvents: events ?? [],
    allEvents: allEvents ?? [],
    excludedDrivers: excludedDriverDetails,
    currentOffer,
    nearbyDrivers,
    escalationCount,
  });
}
