/**
 * Fare calculator for Takeme Seattle.
 *
 * Two modes:
 * 1. Real route — uses Google Directions API data (distance + duration)
 * 2. Estimated route — haversine × road factor (fallback when API unavailable)
 */

const KM_TO_MILES = 0.621371;
const EARTH_RADIUS_KM = 6371;
const ROAD_FACTOR = 1.3;
const AVG_CITY_SPEED_MPH = 18;

interface Coords {
  latitude: number;
  longitude: number;
}

export interface RouteEstimate {
  distanceKm: number;
  distanceMi: number;
  durationMin: number;
  source: 'directions' | 'haversine';
}

export interface FareQuote {
  vehicleClass: string;
  label: string;
  description: string;
  capacity: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
  minFare: number;
}

const TIERS = [
  { id: 'electric',          label: 'Electric',           desc: 'Affordable electric rides',    cap: 4, base: 4.0,  perMi: 1.9, perMin: 0.25, min: 8.0  },
  { id: 'comfort_electric',  label: 'Comfort Electric',   desc: 'Premium electric comfort',     cap: 4, base: 6.0,  perMi: 2.8, perMin: 0.35, min: 12.0 },
  { id: 'premium_electric',  label: 'Premium Electric',   desc: 'Luxury electric experience',   cap: 4, base: 10.0, perMi: 4.2, perMin: 0.50, min: 18.0 },
  { id: 'suv_electric',      label: 'SUV Electric',       desc: 'Spacious electric SUV',        cap: 6, base: 12.0, perMi: 4.8, perMin: 0.55, min: 22.0 },
  { id: 'women_rider',       label: 'Women Rider',        desc: 'Women-preferred drivers',      cap: 4, base: 5.0,  perMi: 2.2, perMin: 0.30, min: 10.0 },
  { id: 'pet_ride',          label: 'Pet Friendly',       desc: 'Rides with your pet',          cap: 4, base: 6.0,  perMi: 2.4, perMin: 0.30, min: 12.0 },
] as const;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Create a route estimate from Google Directions API data */
export function routeFromDirections(distanceMi: number, durationMin: number): RouteEstimate {
  return {
    distanceKm: distanceMi / KM_TO_MILES,
    distanceMi,
    durationMin,
    source: 'directions',
  };
}

/** Fallback: estimate route from coordinates using haversine */
export function estimateRoute(pickup: Coords, dropoff: Coords): RouteEstimate {
  const straightKm = haversineKm(pickup, dropoff);
  const roadKm = straightKm * ROAD_FACTOR;
  const roadMi = roadKm * KM_TO_MILES;
  const durationMin = (roadMi / AVG_CITY_SPEED_MPH) * 60;

  return { distanceKm: roadKm, distanceMi: roadMi, durationMin, source: 'haversine' };
}

/** Calculate fares for all vehicle tiers given a route */
export function calculateFares(route: RouteEstimate): FareQuote[] {
  return TIERS.map((tier) => {
    const distanceFare = route.distanceMi * tier.perMi;
    const timeFare = route.durationMin * tier.perMin;
    const rawTotal = tier.base + distanceFare + timeFare;
    const totalFare = Math.max(rawTotal, tier.min);

    return {
      vehicleClass: tier.id,
      label: tier.label,
      description: tier.desc,
      capacity: tier.cap,
      baseFare: tier.base,
      distanceFare,
      timeFare,
      totalFare: Math.round(totalFare * 100) / 100,
      minFare: tier.min,
    };
  });
}
