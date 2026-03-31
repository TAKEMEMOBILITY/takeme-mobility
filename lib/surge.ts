// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — Surge Pricing Engine
// Dynamic pricing based on real-time supply/demand ratio.
//
// Formula:
//   surgeMultiplier = baseMultiplier + demandPressure
//   demandPressure = max(0, (activeRides - availableDrivers) / availableDrivers * scaleFactor)
//
// Constraints:
//   - Minimum: 1.0x (never below base price)
//   - Maximum: 3.0x (capped to prevent gouging)
//   - Smoothing: changes capped at 0.25x per calculation interval
//   - Time-of-day adjustments: rush hour, late night
//
// Usage:
//   const multiplier = await calculateSurge(lat, lng);
//   const fare = baseFare * multiplier;
// ═══════════════════════════════════════════════════════════════════════════

import { createServiceClient } from '@/lib/supabase/service';
import { getRedis } from '@/lib/redis';

const MIN_SURGE = 1.0;
const MAX_SURGE = 3.0;
const MAX_CHANGE_PER_INTERVAL = 0.25;
const SURGE_CACHE_TTL = 60; // seconds
const DEMAND_SCALE_FACTOR = 0.5;

interface SurgeData {
  multiplier: number;
  activeRides: number;
  availableDrivers: number;
  demandRatio: number;
  reason: string;
}

/**
 * Calculate surge multiplier for a geographic area.
 * Uses a grid cell (~5km) to aggregate supply/demand.
 */
export async function calculateSurge(lat: number, lng: number): Promise<SurgeData> {
  const cellKey = `surge:${gridCell(lat, lng)}`;
  const r = getRedis();

  // Check cache first
  try {
    const cached = await r.get<string>(cellKey);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return data as SurgeData;
    }
  } catch { /* cache miss, compute fresh */ }

  // Query real-time supply and demand from DB
  const supabase = createServiceClient();

  // Count active rides in area (demand)
  const { count: activeRides } = await supabase
    .from('rides')
    .select('*', { count: 'exact', head: true })
    .in('status', ['searching_driver', 'driver_assigned', 'driver_arriving', 'arrived', 'in_progress']);

  // Count available drivers in area (supply)
  const { count: availableDrivers } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'available')
    .eq('is_active', true)
    .eq('is_verified', true);

  const demand = activeRides ?? 0;
  const supply = Math.max(1, availableDrivers ?? 1); // prevent division by zero

  // Calculate demand pressure
  const demandRatio = demand / supply;
  let demandPressure = 0;

  if (demand > supply) {
    demandPressure = ((demand - supply) / supply) * DEMAND_SCALE_FACTOR;
  }

  // Time-of-day adjustment
  const hour = new Date().getHours();
  let timeAdjustment = 0;
  let reason = 'Normal demand';

  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    timeAdjustment = 0.2; // Rush hour
    reason = 'Rush hour';
  } else if (hour >= 22 || hour <= 5) {
    timeAdjustment = 0.3; // Late night
    reason = 'Late night';
  } else if (hour >= 11 && hour <= 14) {
    timeAdjustment = 0.1; // Lunch
    reason = 'Lunch rush';
  }

  // Only apply time adjustment if there's actual demand
  if (demand < 3) timeAdjustment = 0;

  // Apply smoothing — get previous multiplier
  let previousMultiplier = 1.0;
  try {
    const prev = await r.get<string>(`${cellKey}:prev`);
    if (prev) previousMultiplier = typeof prev === 'string' ? parseFloat(prev) : (prev as number);
  } catch { /* use default */ }

  let rawMultiplier = MIN_SURGE + demandPressure + timeAdjustment;

  // Smooth — cap change per interval
  const change = rawMultiplier - previousMultiplier;
  if (Math.abs(change) > MAX_CHANGE_PER_INTERVAL) {
    rawMultiplier = previousMultiplier + Math.sign(change) * MAX_CHANGE_PER_INTERVAL;
  }

  // Clamp
  const multiplier = Math.round(Math.min(MAX_SURGE, Math.max(MIN_SURGE, rawMultiplier)) * 100) / 100;

  if (demandPressure > 0) {
    reason = `High demand (${demand} rides, ${supply} drivers)`;
  }

  const result: SurgeData = {
    multiplier,
    activeRides: demand,
    availableDrivers: supply,
    demandRatio: Math.round(demandRatio * 100) / 100,
    reason,
  };

  // Cache result + store previous
  try {
    await r.set(cellKey, JSON.stringify(result), { ex: SURGE_CACHE_TTL });
    await r.set(`${cellKey}:prev`, multiplier.toString(), { ex: 300 });
  } catch { /* non-fatal */ }

  return result;
}

/**
 * Get surge multiplier only (for fare calculation).
 */
export async function getSurgeMultiplier(lat: number, lng: number): Promise<number> {
  const data = await calculateSurge(lat, lng);
  return data.multiplier;
}

/**
 * Grid cell key for geographic area (~5km cells).
 * Groups nearby locations into the same surge zone.
 */
function gridCell(lat: number, lng: number): string {
  // ~5km cells: round to 2 decimal places (~1.1km lat, ~0.8km lng at 47°N)
  const cellLat = Math.round(lat * 20) / 20; // 0.05° steps
  const cellLng = Math.round(lng * 20) / 20;
  return `${cellLat},${cellLng}`;
}
