import { createServiceClient } from '@/lib/supabase/service';
import { FleetError, FleetErrorCode } from '@/lib/fleet/errors';

// ═══════════════════════════════════════════════════════════════════════════
// TakeMe Fleet — Vehicle Service
// Vehicle CRUD, photos, pricing, availability, admin review workflows
// ═══════════════════════════════════════════════════════════════════════════

const LOG_PREFIX = '[VehicleService]';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CreateVehicleInput {
  make: string;
  model: string;
  year: number;
  vin?: string;
  plate?: string;
  color?: string;
  bodyType?: string;
  seating?: number;
  rangeMiles?: number;
  chargingType?: string;
  connectorType?: string;
  batteryCapacityKwh?: number;
  performanceCategory?: string;
  pickupAddress?: string;
  pickupInstructions?: string;
  dailyRateCents: number;
  weeklyRateCents?: number;
  monthlyRateCents?: number;
  depositAmountCents?: number;
  minRentalDays?: number;
  minDriverAge?: number;
  mileageLimitDaily?: number;
  excessMileageCents?: number;
  cleaningFeeCents?: number;
  accessories?: string[];
  ownerNotes?: string;
}

export interface SetPricingInput {
  dailyRateCents: number;
  weeklyRateCents?: number;
  monthlyRateCents?: number;
  depositAmountCents?: number;
  mileageLimitDaily?: number;
  excessMileageCents?: number;
  cleaningFeeCents?: number;
}

export interface MarketplaceFilters {
  city?: string;
  type?: string;
  minRange?: number;
  maxPrice?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function mapInputToColumns(input: Partial<CreateVehicleInput>): Record<string, unknown> {
  const map: Record<string, unknown> = {};

  if (input.make !== undefined) map.make = input.make;
  if (input.model !== undefined) map.model = input.model;
  if (input.year !== undefined) map.year = input.year;
  if (input.vin !== undefined) map.vin = input.vin;
  if (input.plate !== undefined) map.plate = input.plate;
  if (input.color !== undefined) map.color = input.color;
  if (input.bodyType !== undefined) map.body_type = input.bodyType;
  if (input.seating !== undefined) map.seating = input.seating;
  if (input.rangeMiles !== undefined) map.range_miles = input.rangeMiles;
  if (input.chargingType !== undefined) map.charging_type = input.chargingType;
  if (input.connectorType !== undefined) map.connector_type = input.connectorType;
  if (input.batteryCapacityKwh !== undefined) map.battery_capacity_kwh = input.batteryCapacityKwh;
  if (input.performanceCategory !== undefined) map.performance_category = input.performanceCategory;
  if (input.pickupAddress !== undefined) map.pickup_address = input.pickupAddress;
  if (input.pickupInstructions !== undefined) map.pickup_instructions = input.pickupInstructions;
  if (input.dailyRateCents !== undefined) map.daily_rate_cents = input.dailyRateCents;
  if (input.weeklyRateCents !== undefined) map.weekly_rate_cents = input.weeklyRateCents;
  if (input.monthlyRateCents !== undefined) map.monthly_rate_cents = input.monthlyRateCents;
  if (input.depositAmountCents !== undefined) map.deposit_amount_cents = input.depositAmountCents;
  if (input.minRentalDays !== undefined) map.min_rental_days = input.minRentalDays;
  if (input.minDriverAge !== undefined) map.min_driver_age = input.minDriverAge;
  if (input.mileageLimitDaily !== undefined) map.mileage_limit_daily = input.mileageLimitDaily;
  if (input.excessMileageCents !== undefined) map.excess_mileage_cents = input.excessMileageCents;
  if (input.cleaningFeeCents !== undefined) map.cleaning_fee_cents = input.cleaningFeeCents;
  if (input.accessories !== undefined) map.accessories = input.accessories;
  if (input.ownerNotes !== undefined) map.owner_notes = input.ownerNotes;

  return map;
}

async function verifyOwnership(vehicleId: string, ownerId: string) {
  const svc = createServiceClient();

  const { data: vehicle, error } = await svc
    .from('fleet_vehicles')
    .select('id, owner_id, status')
    .eq('id', vehicleId)
    .single();

  if (error || !vehicle) {
    if (error?.code === 'PGRST116' || !vehicle) {
      throw new FleetError(FleetErrorCode.NOT_FOUND, 'Vehicle not found');
    }
    console.error(LOG_PREFIX, 'Failed to fetch vehicle for ownership check', error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to verify vehicle ownership');
  }

  if (vehicle.owner_id !== ownerId) {
    throw new FleetError(FleetErrorCode.FORBIDDEN, 'You do not own this vehicle');
  }

  return vehicle;
}

// ── Create vehicle ────────────────────────────────────────────────────────

export async function createVehicle(ownerId: string, input: CreateVehicleInput) {
  const svc = createServiceClient();

  const columns = {
    ...mapInputToColumns(input),
    owner_id: ownerId,
    status: 'draft',
  };

  const { data, error } = await svc
    .from('fleet_vehicles')
    .insert(columns)
    .select('id')
    .single();

  if (error || !data) {
    console.error(LOG_PREFIX, 'Failed to create vehicle', error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to create vehicle');
  }

  return { id: data.id as string };
}

// ── Update vehicle ────────────────────────────────────────────────────────

export async function updateVehicle(
  vehicleId: string,
  ownerId: string,
  updates: Partial<CreateVehicleInput>,
) {
  const vehicle = await verifyOwnership(vehicleId, ownerId);

  const editableStatuses = new Set(['draft', 'pending_documents']);
  if (!editableStatuses.has(vehicle.status as string)) {
    throw new FleetError(
      FleetErrorCode.INVALID_STATUS,
      `Cannot edit vehicle with status "${vehicle.status}"`,
    );
  }

  const columns = {
    ...mapInputToColumns(updates),
    updated_at: new Date().toISOString(),
  };

  const svc = createServiceClient();
  const { error } = await svc
    .from('fleet_vehicles')
    .update(columns)
    .eq('id', vehicleId);

  if (error) {
    console.error(LOG_PREFIX, 'Failed to update vehicle', error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to update vehicle');
  }
}

// ── Upload photo ──────────────────────────────────────────────────────────

export async function uploadPhoto(vehicleId: string, ownerId: string, file: File) {
  await verifyOwnership(vehicleId, ownerId);

  const svc = createServiceClient();
  const timestamp = Date.now();
  const filePath = `${vehicleId}/${timestamp}_${file.name}`;

  const { error: uploadError } = await svc.storage
    .from('fleet-vehicle-photos')
    .upload(filePath, file);

  if (uploadError) {
    console.error(LOG_PREFIX, 'Failed to upload photo to storage', uploadError);
    throw new FleetError(FleetErrorCode.UPLOAD_ERROR, 'Failed to upload photo');
  }

  const { data: urlData } = svc.storage
    .from('fleet-vehicle-photos')
    .getPublicUrl(filePath);

  const fileUrl = urlData.publicUrl;

  // Get current max sort_order
  const { data: existing } = await svc
    .from('vehicle_photos')
    .select('sort_order')
    .eq('vehicle_id', vehicleId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order as number) + 1 : 0;

  const { error: insertError } = await svc
    .from('vehicle_photos')
    .insert({
      vehicle_id: vehicleId,
      photo_type: 'exterior',
      file_url: fileUrl,
      sort_order: nextOrder,
    });

  if (insertError) {
    console.error(LOG_PREFIX, 'Failed to insert photo record', insertError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to save photo record');
  }

  return { fileUrl };
}

// ── Delete photo ──────────────────────────────────────────────────────────

export async function deletePhoto(vehicleId: string, ownerId: string, photoId: string) {
  await verifyOwnership(vehicleId, ownerId);

  const svc = createServiceClient();

  // Fetch the photo record
  const { data: photo, error: fetchError } = await svc
    .from('vehicle_photos')
    .select('id, file_url')
    .eq('id', photoId)
    .eq('vehicle_id', vehicleId)
    .single();

  if (fetchError || !photo) {
    if (fetchError?.code === 'PGRST116' || !photo) {
      throw new FleetError(FleetErrorCode.NOT_FOUND, 'Photo not found');
    }
    console.error(LOG_PREFIX, 'Failed to fetch photo for deletion', fetchError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to fetch photo');
  }

  // Extract storage path from the public URL
  const fileUrl = photo.file_url as string;
  const bucketPrefix = '/fleet-vehicle-photos/';
  const pathIndex = fileUrl.indexOf(bucketPrefix);
  if (pathIndex !== -1) {
    const storagePath = fileUrl.substring(pathIndex + bucketPrefix.length);
    const { error: removeError } = await svc.storage
      .from('fleet-vehicle-photos')
      .remove([storagePath]);

    if (removeError) {
      console.error(LOG_PREFIX, 'Failed to remove photo from storage', removeError);
      // Continue to delete DB record even if storage removal fails
    }
  }

  const { error: deleteError } = await svc
    .from('vehicle_photos')
    .delete()
    .eq('id', photoId);

  if (deleteError) {
    console.error(LOG_PREFIX, 'Failed to delete photo record', deleteError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to delete photo record');
  }
}

// ── Set pricing ───────────────────────────────────────────────────────────

export async function setPricing(vehicleId: string, ownerId: string, input: SetPricingInput) {
  await verifyOwnership(vehicleId, ownerId);

  const svc = createServiceClient();

  const columns: Record<string, unknown> = {
    daily_rate_cents: input.dailyRateCents,
    updated_at: new Date().toISOString(),
  };

  if (input.weeklyRateCents !== undefined) columns.weekly_rate_cents = input.weeklyRateCents;
  if (input.monthlyRateCents !== undefined) columns.monthly_rate_cents = input.monthlyRateCents;
  if (input.depositAmountCents !== undefined) columns.deposit_amount_cents = input.depositAmountCents;
  if (input.mileageLimitDaily !== undefined) columns.mileage_limit_daily = input.mileageLimitDaily;
  if (input.excessMileageCents !== undefined) columns.excess_mileage_cents = input.excessMileageCents;
  if (input.cleaningFeeCents !== undefined) columns.cleaning_fee_cents = input.cleaningFeeCents;

  const { error } = await svc
    .from('fleet_vehicles')
    .update(columns)
    .eq('id', vehicleId);

  if (error) {
    console.error(LOG_PREFIX, 'Failed to set pricing', error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to update pricing');
  }
}

// ── Submit for review ─────────────────────────────────────────────────────

export async function submitForReview(vehicleId: string, ownerId: string) {
  const vehicle = await verifyOwnership(vehicleId, ownerId);

  const submittableStatuses = new Set(['draft', 'pending_documents']);
  if (!submittableStatuses.has(vehicle.status as string)) {
    throw new FleetError(
      FleetErrorCode.INVALID_STATUS,
      `Cannot submit vehicle with status "${vehicle.status}"`,
    );
  }

  const svc = createServiceClient();

  // Verify at least 1 photo exists
  const { count, error: countError } = await svc
    .from('vehicle_photos')
    .select('id', { count: 'exact', head: true })
    .eq('vehicle_id', vehicleId);

  if (countError) {
    console.error(LOG_PREFIX, 'Failed to count vehicle photos', countError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to verify photos');
  }

  if (!count || count < 1) {
    throw new FleetError(
      FleetErrorCode.VALIDATION_ERROR,
      'At least one photo is required before submitting for review',
    );
  }

  const { error: updateError } = await svc
    .from('fleet_vehicles')
    .update({
      status: 'pending_review',
      updated_at: new Date().toISOString(),
    })
    .eq('id', vehicleId);

  if (updateError) {
    console.error(LOG_PREFIX, 'Failed to submit vehicle for review', updateError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to submit vehicle for review');
  }
}

// ── Approve vehicle (admin) ───────────────────────────────────────────────

export async function approveVehicle(vehicleId: string, adminId: string) {
  const svc = createServiceClient();

  const { data: vehicle, error: fetchError } = await svc
    .from('fleet_vehicles')
    .select('id, status')
    .eq('id', vehicleId)
    .single();

  if (fetchError || !vehicle) {
    if (fetchError?.code === 'PGRST116' || !vehicle) {
      throw new FleetError(FleetErrorCode.NOT_FOUND, 'Vehicle not found');
    }
    console.error(LOG_PREFIX, 'Failed to fetch vehicle for approval', fetchError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to fetch vehicle');
  }

  if (vehicle.status !== 'pending_review') {
    throw new FleetError(
      FleetErrorCode.INVALID_STATUS,
      `Cannot approve vehicle with status "${vehicle.status}"`,
    );
  }

  const { error: updateError } = await svc
    .from('fleet_vehicles')
    .update({
      status: 'active',
      approved_at: new Date().toISOString(),
      approved_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', vehicleId);

  if (updateError) {
    console.error(LOG_PREFIX, 'Failed to approve vehicle', updateError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to approve vehicle');
  }
}

// ── Reject vehicle (admin) ────────────────────────────────────────────────

export async function rejectVehicle(vehicleId: string, adminId: string, reason: string) {
  const svc = createServiceClient();

  const { data: vehicle, error: fetchError } = await svc
    .from('fleet_vehicles')
    .select('id, status')
    .eq('id', vehicleId)
    .single();

  if (fetchError || !vehicle) {
    if (fetchError?.code === 'PGRST116' || !vehicle) {
      throw new FleetError(FleetErrorCode.NOT_FOUND, 'Vehicle not found');
    }
    console.error(LOG_PREFIX, 'Failed to fetch vehicle for rejection', fetchError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to fetch vehicle');
  }

  if (vehicle.status !== 'pending_review') {
    throw new FleetError(
      FleetErrorCode.INVALID_STATUS,
      `Cannot reject vehicle with status "${vehicle.status}"`,
    );
  }

  const { error: updateError } = await svc
    .from('fleet_vehicles')
    .update({
      status: 'rejected',
      rejected_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', vehicleId);

  if (updateError) {
    console.error(LOG_PREFIX, 'Failed to reject vehicle', updateError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to reject vehicle');
  }
}

// ── Block dates ───────────────────────────────────────────────────────────

export async function blockDates(
  vehicleId: string,
  ownerId: string,
  input: { from: string; until: string; reason?: string },
) {
  await verifyOwnership(vehicleId, ownerId);

  const svc = createServiceClient();

  const { error } = await svc
    .from('vehicle_availability')
    .insert({
      vehicle_id: vehicleId,
      available_from: input.from,
      available_until: input.until,
      blocked: true,
      block_reason: input.reason ?? null,
    });

  if (error) {
    console.error(LOG_PREFIX, 'Failed to block dates', error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to block dates');
  }
}

// ── Get vehicle ───────────────────────────────────────────────────────────

export async function getVehicle(vehicleId: string) {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('fleet_vehicles')
    .select('*, vehicle_photos(*)')
    .eq('id', vehicleId)
    .single();

  if (error || !data) {
    if (error?.code === 'PGRST116' || !data) {
      throw new FleetError(FleetErrorCode.NOT_FOUND, 'Vehicle not found');
    }
    console.error(LOG_PREFIX, 'Failed to fetch vehicle', error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to fetch vehicle');
  }

  return data;
}

// ── List marketplace ──────────────────────────────────────────────────────

export async function listMarketplace(filters: MarketplaceFilters) {
  const svc = createServiceClient();

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  let query = svc
    .from('fleet_vehicles')
    .select('*, vehicle_photos(*)', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.type) {
    query = query.eq('body_type', filters.type);
  }

  if (filters.minRange) {
    query = query.gte('range_miles', filters.minRange);
  }

  if (filters.maxPrice) {
    query = query.lte('daily_rate_cents', filters.maxPrice);
  }

  if (filters.city) {
    query = query.ilike('pickup_address', `%${filters.city}%`);
  }

  if (filters.startDate && filters.endDate) {
    // Exclude vehicles that have blocked availability overlapping the requested range
    // This is handled by filtering out vehicles with blocking entries
    // A more sophisticated approach would use a subquery, but we filter post-query
  }

  const { data, error, count } = await query;

  if (error) {
    console.error(LOG_PREFIX, 'Failed to list marketplace vehicles', error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to list marketplace vehicles');
  }

  let vehicles = data ?? [];

  // Post-filter for date availability if date range is specified
  if (filters.startDate && filters.endDate && vehicles.length > 0) {
    const vehicleIds = vehicles.map((v) => v.id as string);

    const { data: blocked } = await svc
      .from('vehicle_availability')
      .select('vehicle_id')
      .in('vehicle_id', vehicleIds)
      .eq('blocked', true)
      .lte('available_from', filters.endDate)
      .gte('available_until', filters.startDate);

    if (blocked && blocked.length > 0) {
      const blockedIds = new Set(blocked.map((b) => b.vehicle_id as string));
      vehicles = vehicles.filter((v) => !blockedIds.has(v.id as string));
    }
  }

  return {
    vehicles,
    total: count ?? 0,
  };
}
