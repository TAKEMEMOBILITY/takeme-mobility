import type { LocationWithAddress } from './location';

export type RideStatus =
  | 'pending'
  | 'quoted'
  | 'searching_driver'
  | 'driver_assigned'
  | 'driver_arriving'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type VehicleClass =
  | 'electric'
  | 'comfort_electric'
  | 'premium_electric'
  | 'suv_electric'
  | 'women_rider'
  | 'pet_ride';

export type CancelledBy = 'rider' | 'driver' | 'system';

export type RideEventType =
  | 'status_change'
  | 'location_update'
  | 'fare_adjusted'
  | 'driver_assigned'
  | 'driver_unassigned'
  | 'payment_authorized'
  | 'payment_captured'
  | 'cancellation';

export interface Ride {
  id: string;
  rider_id: string;
  assigned_driver_id: string | null;
  vehicle_id: string | null;
  quote_id: string | null;
  status: RideStatus;
  vehicle_class: VehicleClass;

  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;

  distance_km: number | null;
  duration_min: number | null;
  estimated_fare: number | null;
  final_fare: number | null;
  surge_multiplier: number;

  requested_at: string;
  driver_assigned_at: string | null;
  driver_arrived_at: string | null;
  trip_started_at: string | null;
  trip_completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancelled_by: CancelledBy | null;

  rider_rating: number | null;
  driver_rating: number | null;
}

export interface RideEvent {
  id: string;
  ride_id: string;
  event_type: RideEventType;
  old_status: RideStatus | null;
  new_status: RideStatus | null;
  actor: 'rider' | 'driver' | 'system';
  metadata: Record<string, unknown>;
  created_at: string;
}

/** The pickup/dropoff pair the rider selects before requesting quotes */
export interface RideRequest {
  pickup: LocationWithAddress;
  dropoff: LocationWithAddress;
  vehicle_class: VehicleClass;
  surge_multiplier?: number;
}

/** States where the ride is "active" from the rider's perspective */
export const ACTIVE_RIDE_STATUSES: RideStatus[] = [
  'searching_driver',
  'driver_assigned',
  'driver_arriving',
  'arrived',
  'in_progress',
];

/** States from which a rider can cancel */
export const RIDER_CANCELLABLE_STATUSES: RideStatus[] = [
  'pending',
  'quoted',
  'searching_driver',
  'driver_assigned',
  'driver_arriving',
  'arrived',
];
