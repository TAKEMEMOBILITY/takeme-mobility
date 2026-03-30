'use client';

// ═══════════════════════════════════════════════════════════════════════════
// useActiveRide — Supabase Realtime subscription for live ride status
//
// Subscribes to the rider's active ride row in the `rides` table.
// Also polls driver location for map updates.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type RidePhase =
  | 'searching_driver'
  | 'driver_assigned'
  | 'driver_arriving'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface ActiveRide {
  id: string;
  status: RidePhase;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleClass: string;
  distanceKm: number;
  durationMin: number;
  estimatedFare: number;
  finalFare: number | null;
  currency: string;
  requestedAt: string;
  driverAssignedAt: string | null;
  driverArrivedAt: string | null;
  tripStartedAt: string | null;
  tripCompletedAt: string | null;
  assignedDriverId: string | null;
  vehicleId: string | null;
}

export interface DriverInfo {
  name: string;
  rating: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  plateNumber: string;
}

export interface DriverPosition {
  lat: number;
  lng: number;
  heading: number | null;
}

interface UseActiveRideReturn {
  ride: ActiveRide | null;
  driver: DriverInfo | null;
  driverPosition: DriverPosition | null;
  loading: boolean;
}

export function useActiveRide(rideId: string | null): UseActiveRideReturn {
  const [ride, setRide] = useState<ActiveRide | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [driverPosition, setDriverPosition] = useState<DriverPosition | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  // ── Map DB row to ActiveRide ───────────────────────────────────────
  const mapRow = useCallback((row: Record<string, unknown>): ActiveRide => ({
    id: row.id as string,
    status: row.status as RidePhase,
    pickupAddress: row.pickup_address as string,
    pickupLat: Number(row.pickup_lat),
    pickupLng: Number(row.pickup_lng),
    dropoffAddress: row.dropoff_address as string,
    dropoffLat: Number(row.dropoff_lat),
    dropoffLng: Number(row.dropoff_lng),
    vehicleClass: row.vehicle_class as string,
    distanceKm: Number(row.distance_km),
    durationMin: Number(row.duration_min),
    estimatedFare: Number(row.estimated_fare),
    finalFare: row.final_fare ? Number(row.final_fare) : null,
    currency: (row.currency as string) ?? 'USD',
    requestedAt: row.requested_at as string,
    driverAssignedAt: (row.driver_assigned_at as string) ?? null,
    driverArrivedAt: (row.driver_arrived_at as string) ?? null,
    tripStartedAt: (row.trip_started_at as string) ?? null,
    tripCompletedAt: (row.trip_completed_at as string) ?? null,
    assignedDriverId: (row.assigned_driver_id as string) ?? null,
    vehicleId: (row.vehicle_id as string) ?? null,
  }), []);

  // ── Fetch driver info ──────────────────────────────────────────────
  const fetchDriverInfo = useCallback(async (driverId: string, vehicleId: string | null) => {
    const { data: d } = await supabase
      .from('drivers')
      .select('full_name, rating')
      .eq('id', driverId)
      .single();

    let vehicle = { make: '', model: '', color: '', plate_number: '' };
    if (vehicleId) {
      const { data: v } = await supabase
        .from('vehicles')
        .select('make, model, color, plate_number')
        .eq('id', vehicleId)
        .single();
      if (v) vehicle = v;
    }

    if (d) {
      setDriver({
        name: d.full_name ?? 'Driver',
        rating: Number(d.rating),
        vehicleMake: vehicle.make,
        vehicleModel: vehicle.model,
        vehicleColor: vehicle.color,
        plateNumber: vehicle.plate_number,
      });
    }
  }, [supabase]);

  // ── Fetch driver location ──────────────────────────────────────────
  const fetchDriverLocation = useCallback(async (driverId: string) => {
    const { data } = await supabase
      .from('driver_locations')
      .select('location, heading')
      .eq('driver_id', driverId)
      .single();

    if (data?.location) {
      // PostGIS returns GeoJSON or WKT — parse the point
      const loc = data.location as unknown;
      let lat: number | null = null;
      let lng: number | null = null;

      if (typeof loc === 'object' && loc !== null) {
        const geo = loc as { coordinates?: number[] };
        if (geo.coordinates && geo.coordinates.length >= 2) {
          lng = geo.coordinates[0];
          lat = geo.coordinates[1];
        }
      }

      if (lat !== null && lng !== null) {
        setDriverPosition({
          lat,
          lng,
          heading: data.heading ? Number(data.heading) : null,
        });
      }
    }
  }, [supabase]);

  // ── Initial fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!rideId) {
      setRide(null);
      setDriver(null);
      setDriverPosition(null);
      setLoading(false);
      return;
    }

    async function loadRide() {
      setLoading(true);
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const mapped = mapRow(data);
      setRide(mapped);

      if (mapped.assignedDriverId) {
        await fetchDriverInfo(mapped.assignedDriverId, mapped.vehicleId);
        await fetchDriverLocation(mapped.assignedDriverId);
      }

      setLoading(false);
    }

    loadRide();
  }, [rideId, supabase, mapRow, fetchDriverInfo, fetchDriverLocation]);

  // ── Realtime subscription ──────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return;

    const channel = supabase
      .channel(`ride-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${rideId}`,
        },
        async (payload: { new: Record<string, unknown>; eventType: string }) => {
          const row = payload.new;
          const mapped = mapRow(row);
          setRide(mapped);

          // If driver was just assigned, fetch their info
          if (mapped.assignedDriverId && !driver) {
            await fetchDriverInfo(mapped.assignedDriverId, mapped.vehicleId);
          }

          // Location subscription auto-cleans via useEffect when status changes
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, supabase, mapRow, driver, fetchDriverInfo]);

  // ── Subscribe to driver location via Realtime (replaces 5s polling) ──
  useEffect(() => {
    const driverId = ride?.assignedDriverId;
    const activePhases: RidePhase[] = ['driver_assigned', 'driver_arriving', 'arrived', 'in_progress'];

    if (!driverId || !ride || !activePhases.includes(ride.status)) {
      return;
    }

    // Fetch immediately on mount
    fetchDriverLocation(driverId);

    // Subscribe to realtime updates on driver_locations table
    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          const loc = row.location as unknown;
          let lat: number | null = null;
          let lng: number | null = null;

          if (typeof loc === 'object' && loc !== null) {
            const geo = loc as { coordinates?: number[] };
            if (geo.coordinates && geo.coordinates.length >= 2) {
              lng = geo.coordinates[0];
              lat = geo.coordinates[1];
            }
          }

          if (lat !== null && lng !== null) {
            setDriverPosition({
              lat,
              lng,
              heading: row.heading ? Number(row.heading) : null,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.assignedDriverId, ride?.status, supabase, fetchDriverLocation]);

  return { ride, driver, driverPosition, loading };
}
