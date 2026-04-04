import type { VehicleClass } from './ride';

export interface FareBreakdown {
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  pet_fee: number;
  surge_multiplier: number;
  total_fare: number;
  currency: string;
}

export interface RideQuote {
  id: string;
  rider_id: string;
  vehicle_class: VehicleClass;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_km: number;
  duration_min: number;
  route_polyline: string;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  surge_multiplier: number;
  total_fare: number;
  currency: string;
  expires_at: string;
}

/** Response from the /api/quotes endpoint */
export interface QuotesResponse {
  route: {
    distance_km: number;
    duration_min: number;
    polyline: string;
  };
  quotes: Array<{
    vehicle_class: VehicleClass;
    fare: FareBreakdown;
    eta_minutes: number;
  }>;
  expires_at: string;
}
