import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/admin/drivers — List drivers with filters
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = request.nextUrl;
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  const svc = createServiceClient();

  try {
    let query = svc
      .from('drivers')
      .select(`
        id, auth_user_id, full_name, email, phone, avatar_url,
        license_number, status, rating, total_trips,
        is_verified, is_active, accepts_pets, created_at,
        vehicles ( id, vehicle_class, make, model, year, color, plate_number, capacity, is_active ),
        driver_locations ( location, heading, speed_kmh, updated_at )
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[admin/drivers]', error);
      return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 });
    }

    // Flatten for client
    const drivers = (data ?? []).map((d: Record<string, unknown>) => {
      const vehicles = d.vehicles as Record<string, unknown>[] | null;
      const locations = d.driver_locations as Record<string, unknown>[] | null;
      const activeVehicle = vehicles?.find((v) => v.is_active) ?? vehicles?.[0] ?? null;
      const location = locations?.[0] ?? null;

      return {
        id: d.id,
        auth_user_id: d.auth_user_id,
        full_name: d.full_name,
        email: d.email,
        phone: d.phone,
        avatar_url: d.avatar_url,
        license_number: d.license_number,
        status: d.status,
        rating: d.rating,
        total_trips: d.total_trips,
        is_verified: d.is_verified,
        is_active: d.is_active,
        accepts_pets: d.accepts_pets,
        created_at: d.created_at,
        vehicle: activeVehicle
          ? {
              id: activeVehicle.id,
              vehicle_class: activeVehicle.vehicle_class,
              make: activeVehicle.make,
              model: activeVehicle.model,
              year: activeVehicle.year,
              color: activeVehicle.color,
              plate_number: activeVehicle.plate_number,
            }
          : null,
        last_location_at: location?.updated_at ?? null,
        location_lat: location ? extractLat(location.location) : null,
        location_lng: location ? extractLng(location.location) : null,
        heading: location?.heading ?? null,
        speed_kmh: location?.speed_kmh ?? null,
      };
    });

    return NextResponse.json({ drivers });
  } catch (err) {
    console.error('[admin/drivers]', err);
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 });
  }
}

// Supabase geography point comes as { type: 'Point', coordinates: [lng, lat] } or as a string
function extractLat(location: unknown): number | null {
  if (!location) return null;
  if (typeof location === 'object' && location !== null) {
    const geo = location as { coordinates?: number[] };
    if (geo.coordinates) return geo.coordinates[1] ?? null;
  }
  if (typeof location === 'string') {
    const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (match) return parseFloat(match[2]);
  }
  return null;
}

function extractLng(location: unknown): number | null {
  if (!location) return null;
  if (typeof location === 'object' && location !== null) {
    const geo = location as { coordinates?: number[] };
    if (geo.coordinates) return geo.coordinates[0] ?? null;
  }
  if (typeof location === 'string') {
    const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (match) return parseFloat(match[1]);
  }
  return null;
}
