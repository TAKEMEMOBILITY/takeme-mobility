// ═══════════════════════════════════════════════════════════════════════════
// Seattle Fare Engine — miles + minutes based pricing
// Pure function. No SDK dependencies. Usable client-side and server-side.
// ═══════════════════════════════════════════════════════════════════════════

export type VehicleClass = 'electric' | 'comfort_electric' | 'premium_electric' | 'suv_electric' | 'women_rider';

export interface TierConfig {
  id: VehicleClass;
  name: string;
  subtitle: string;
  baseFare: number;
  perMileRate: number;
  perMinuteRate: number;
  minFare: number;
}

export const SEATTLE_TIERS: TierConfig[] = [
  { id: 'electric',          name: 'Electric',          subtitle: 'Eco-friendly',       baseFare: 4.00,  perMileRate: 1.90, perMinuteRate: 0.25, minFare: 8.00 },
  { id: 'comfort_electric',  name: 'Comfort Electric',  subtitle: 'Extra space',        baseFare: 6.00,  perMileRate: 2.80, perMinuteRate: 0.35, minFare: 12.00 },
  { id: 'premium_electric',  name: 'Premium Electric',  subtitle: 'Luxury EV',          baseFare: 10.00, perMileRate: 4.20, perMinuteRate: 0.50, minFare: 18.00 },
  { id: 'suv_electric',      name: 'SUV Electric',      subtitle: 'Group & luggage',    baseFare: 12.00, perMileRate: 4.80, perMinuteRate: 0.55, minFare: 22.00 },
  { id: 'women_rider',       name: 'Women Rider',       subtitle: 'Women drivers only', baseFare: 5.00,  perMileRate: 2.20, perMinuteRate: 0.30, minFare: 10.00 },
];

export interface FareResult {
  vehicleClass: VehicleClass;
  tierName: string;
  subtitle: string;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  total: number;
  minFareApplied: boolean;
}

const KM_TO_MILES = 0.621371;

export function calculateFare(
  tier: TierConfig,
  distanceKm: number,
  durationMin: number,
): FareResult {
  const miles = distanceKm * KM_TO_MILES;
  const distanceFare = round2(miles * tier.perMileRate);
  const timeFare = round2(durationMin * tier.perMinuteRate);
  const raw = tier.baseFare + distanceFare + timeFare;
  const minFareApplied = raw < tier.minFare;
  const total = round2(Math.max(raw, tier.minFare));

  return {
    vehicleClass: tier.id,
    tierName: tier.name,
    subtitle: tier.subtitle,
    baseFare: tier.baseFare,
    distanceFare,
    timeFare,
    total,
    minFareApplied,
  };
}

export function calculateAllFares(distanceKm: number, durationMin: number): FareResult[] {
  return SEATTLE_TIERS.map(tier => calculateFare(tier, distanceKm, durationMin));
}

export function kmToMiles(km: number): number {
  return round2(km * KM_TO_MILES);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
