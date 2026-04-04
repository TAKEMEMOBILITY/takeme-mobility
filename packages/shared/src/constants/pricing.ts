import type { VehicleClass } from '../types/ride';

export interface VehicleClassConfig {
  label: string;
  description: string;
  icon: string;
  capacity: number;
  baseFare: number;
  perMileRate: number;
  perMinuteRate: number;
  minFare: number;
}

export const VEHICLE_CLASS_CONFIG: Record<VehicleClass, VehicleClassConfig> = {
  electric: {
    label: 'Electric',
    description: 'Affordable electric rides',
    icon: 'car',
    capacity: 4,
    baseFare: 4.0,
    perMileRate: 1.9,
    perMinuteRate: 0.25,
    minFare: 8.0,
  },
  comfort_electric: {
    label: 'Comfort',
    description: 'Premium electric comfort',
    icon: 'car',
    capacity: 4,
    baseFare: 6.0,
    perMileRate: 2.8,
    perMinuteRate: 0.35,
    minFare: 12.0,
  },
  premium_electric: {
    label: 'Premium',
    description: 'Luxury electric experience',
    icon: 'crown',
    capacity: 4,
    baseFare: 10.0,
    perMileRate: 4.2,
    perMinuteRate: 0.5,
    minFare: 18.0,
  },
  suv_electric: {
    label: 'SUV',
    description: 'Spacious electric SUV',
    icon: 'truck',
    capacity: 6,
    baseFare: 12.0,
    perMileRate: 4.8,
    perMinuteRate: 0.55,
    minFare: 22.0,
  },
  women_rider: {
    label: 'Women',
    description: 'Women-preferred drivers',
    icon: 'shield',
    capacity: 4,
    baseFare: 5.0,
    perMileRate: 2.2,
    perMinuteRate: 0.3,
    minFare: 10.0,
  },
  pet_ride: {
    label: 'Pet Friendly',
    description: 'Rides with your pet',
    icon: 'paw-print',
    capacity: 4,
    baseFare: 6.0,
    perMileRate: 2.4,
    perMinuteRate: 0.3,
    minFare: 12.0,
  },
};

export const DEFAULT_VEHICLE_CLASS: VehicleClass = 'electric';
export const QUOTE_TTL_MINUTES = 5;
export const CURRENCY = 'USD';
