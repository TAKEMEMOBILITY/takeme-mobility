// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — Fraud Detection Engine
//
// 8 checks, unified scoring (0-100):
//   1. GPS spoofing (impossible speed, teleporting, straight-line)
//   2. Minimum trip distance/time validation
//   3. Route deviation (actual vs Google Maps optimal)
//   4. Pickup/dropoff proximity verification
//   5. Device fingerprinting + permanent ban
//   6. Phone/email reuse detection
//   7. Driver-rider collusion (pair frequency)
//   8. Real-time fraud score with auto-flag/cancel
//
// Actions: score >70 → flag for review, score >90 → auto-cancel
// All events → Sentry + fraud_events table + admin dashboard
// ═══════════════════════════════════════════════════════════════════════════

import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';

// ── Types ────────────────────────────────────────────────────────────────

interface FraudCheckResult {
  check: string;
  score: number;       // 0-100 contribution
  weight: number;      // 0-1 weight
  passed: boolean;
  detail: string;
}

interface FraudAssessment {
  totalScore: number;
  checks: FraudCheckResult[];
  action: 'allow' | 'flag' | 'cancel' | 'ban';
  reasons: string[];
}

interface TripData {
  rideId: string;
  riderId: string;
  driverId: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  durationMin: number;
  estimatedDistanceKm?: number;
  estimatedDurationMin?: number;
}

interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

// ── Constants ────────────────────────────────────────────────────────────

const MAX_SPEED_KMH = 200;           // Impossible for city driving
const TELEPORT_THRESHOLD_KM = 5;     // 5km jump in <10 seconds
const MIN_TRIP_DISTANCE_KM = 0.1;    // 100 meters minimum
const MIN_TRIP_DURATION_SEC = 30;     // 30 seconds minimum
const ROUTE_DEVIATION_THRESHOLD = 1.4; // 40% longer than optimal
const PICKUP_PROXIMITY_M = 500;      // Must be within 500m at pickup
const COLLUSION_PAIR_THRESHOLD = 5;  // Same pair 5+ times = suspicious
const COLLUSION_WINDOW_DAYS = 30;

const SCORE_FLAG = 70;
const SCORE_CANCEL = 90;

// ── Haversine ────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 1: GPS Spoofing Detection
// ═══════════════════════════════════════════════════════════════════════════

export function checkGpsSpoofing(locationHistory: LocationPoint[]): FraudCheckResult {
  if (locationHistory.length < 2) {
    return { check: 'gps_spoofing', score: 0, weight: 0.2, passed: true, detail: 'Insufficient data' };
  }

  let maxSpeed = 0;
  let teleportCount = 0;
  let straightLineCount = 0;

  for (let i = 1; i < locationHistory.length; i++) {
    const prev = locationHistory[i - 1];
    const curr = locationHistory[i];
    const distKm = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
    const timeSec = (curr.timestamp - prev.timestamp) / 1000;

    if (timeSec <= 0) continue;

    const speedKmh = (distKm / timeSec) * 3600;
    maxSpeed = Math.max(maxSpeed, speedKmh);

    // Teleporting: >5km in <10 seconds
    if (distKm > TELEPORT_THRESHOLD_KM && timeSec < 10) {
      teleportCount++;
    }
  }

  // Check for perfectly straight-line movement (bot pattern)
  if (locationHistory.length >= 5) {
    const bearings: number[] = [];
    for (let i = 1; i < locationHistory.length; i++) {
      const b = Math.atan2(
        locationHistory[i].lng - locationHistory[i - 1].lng,
        locationHistory[i].lat - locationHistory[i - 1].lat,
      ) * 180 / Math.PI;
      bearings.push(b);
    }
    const bearingVariance = bearings.reduce((sum, b, _, arr) => {
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
      return sum + (b - mean) ** 2;
    }, 0) / bearings.length;
    if (bearingVariance < 0.5) straightLineCount++;
  }

  let score = 0;
  const reasons: string[] = [];

  if (maxSpeed > MAX_SPEED_KMH) {
    score += 40;
    reasons.push(`Impossible speed: ${Math.round(maxSpeed)} km/h`);
  }
  if (teleportCount > 0) {
    score += 50;
    reasons.push(`Teleporting detected: ${teleportCount} jumps`);
  }
  if (straightLineCount > 0) {
    score += 20;
    reasons.push('Perfectly straight-line movement (bot pattern)');
  }

  return {
    check: 'gps_spoofing',
    score: Math.min(100, score),
    weight: 0.2,
    passed: score < 30,
    detail: reasons.length > 0 ? reasons.join('; ') : 'GPS patterns normal',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 2: Minimum Trip Distance/Time
// ═══════════════════════════════════════════════════════════════════════════

export function checkMinimumTrip(distanceKm: number, durationSec: number): FraudCheckResult {
  let score = 0;
  const reasons: string[] = [];

  if (distanceKm < MIN_TRIP_DISTANCE_KM) {
    score += 60;
    reasons.push(`Trip too short: ${(distanceKm * 1000).toFixed(0)}m`);
  }
  if (durationSec < MIN_TRIP_DURATION_SEC) {
    score += 40;
    reasons.push(`Trip too fast: ${durationSec}s`);
  }
  // Zero distance with significant fare = ghost ride
  if (distanceKm === 0 && durationSec > 60) {
    score = 90;
    reasons.push('Zero distance with elapsed time (ghost ride)');
  }

  return {
    check: 'minimum_trip',
    score: Math.min(100, score),
    weight: 0.15,
    passed: score < 30,
    detail: reasons.length > 0 ? reasons.join('; ') : 'Trip meets minimums',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 3: Route Deviation
// ═══════════════════════════════════════════════════════════════════════════

export function checkRouteDeviation(
  actualDistanceKm: number,
  estimatedDistanceKm: number,
): FraudCheckResult {
  if (!estimatedDistanceKm || estimatedDistanceKm <= 0) {
    return { check: 'route_deviation', score: 0, weight: 0.15, passed: true, detail: 'No estimated route available' };
  }

  const ratio = actualDistanceKm / estimatedDistanceKm;
  let score = 0;
  let detail = `Ratio: ${ratio.toFixed(2)}x optimal`;

  if (ratio > ROUTE_DEVIATION_THRESHOLD) {
    score = Math.min(100, Math.round((ratio - 1) * 100));
    detail = `Route ${Math.round((ratio - 1) * 100)}% longer than optimal (${actualDistanceKm.toFixed(1)}km vs ${estimatedDistanceKm.toFixed(1)}km est.)`;
  }
  // Suspiciously short route (might be manipulated)
  if (ratio < 0.5 && actualDistanceKm > 1) {
    score = 40;
    detail = `Route suspiciously short vs estimate`;
  }

  return {
    check: 'route_deviation',
    score,
    weight: 0.15,
    passed: score < 30,
    detail,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 4: Pickup/Dropoff Proximity Verification
// ═══════════════════════════════════════════════════════════════════════════

export function checkProximity(
  expected: { lat: number; lng: number },
  actual: { lat: number; lng: number },
  label: string,
): FraudCheckResult {
  const distM = haversineKm(expected.lat, expected.lng, actual.lat, actual.lng) * 1000;

  let score = 0;
  if (distM > PICKUP_PROXIMITY_M) {
    score = Math.min(100, Math.round((distM - PICKUP_PROXIMITY_M) / 10));
  }

  return {
    check: `proximity_${label}`,
    score,
    weight: 0.1,
    passed: distM <= PICKUP_PROXIMITY_M,
    detail: `${label} distance: ${Math.round(distM)}m from expected (threshold: ${PICKUP_PROXIMITY_M}m)`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 5: Device Fingerprint + Ban Check
// ═══════════════════════════════════════════════════════════════════════════

export async function checkDeviceBan(fingerprint: string | null, ip: string | null): Promise<FraudCheckResult> {
  if (!fingerprint && !ip) {
    return { check: 'device_ban', score: 10, weight: 0.1, passed: true, detail: 'No fingerprint available' };
  }

  const svc = createServiceClient();

  // Check device ban
  if (fingerprint) {
    const { data: ban } = await svc
      .from('device_bans')
      .select('reason')
      .eq('device_fingerprint', fingerprint)
      .maybeSingle();

    if (ban) {
      return { check: 'device_ban', score: 100, weight: 0.1, passed: false, detail: `BANNED DEVICE: ${ban.reason}` };
    }
  }

  // Check IP ban
  if (ip) {
    const { data: ipBan } = await svc
      .from('device_bans')
      .select('reason')
      .eq('ip_address', ip)
      .maybeSingle();

    if (ipBan) {
      return { check: 'device_ban', score: 80, weight: 0.1, passed: false, detail: `Banned IP: ${ipBan.reason}` };
    }
  }

  return { check: 'device_ban', score: 0, weight: 0.1, passed: true, detail: 'Device not banned' };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 6: Phone/Email Reuse Detection
// ═══════════════════════════════════════════════════════════════════════════

export async function checkAccountReuse(
  userId: string,
  phone?: string,
  email?: string,
  fingerprint?: string,
): Promise<FraudCheckResult> {
  const svc = createServiceClient();
  let score = 0;
  const reasons: string[] = [];

  // Check phone reuse
  if (phone) {
    const { data: phoneAccounts } = await svc
      .from('account_identifiers')
      .select('user_id')
      .eq('identifier_type', 'phone')
      .eq('identifier_value', phone)
      .neq('user_id', userId);

    if (phoneAccounts && phoneAccounts.length > 0) {
      score += 40;
      reasons.push(`Phone used by ${phoneAccounts.length} other account(s)`);
    }
  }

  // Check device fingerprint reuse
  if (fingerprint) {
    const { data: deviceAccounts } = await svc
      .from('account_identifiers')
      .select('user_id')
      .eq('identifier_type', 'device')
      .eq('identifier_value', fingerprint)
      .neq('user_id', userId);

    if (deviceAccounts && deviceAccounts.length > 1) {
      score += 30;
      reasons.push(`Device used by ${deviceAccounts.length} other account(s)`);
    }
  }

  // Check email pattern (disposable email domains)
  if (email) {
    const disposableDomains = ['tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com', 'yopmail.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && disposableDomains.includes(domain)) {
      score += 30;
      reasons.push(`Disposable email domain: ${domain}`);
    }
  }

  return {
    check: 'account_reuse',
    score: Math.min(100, score),
    weight: 0.1,
    passed: score < 30,
    detail: reasons.length > 0 ? reasons.join('; ') : 'No account reuse detected',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 7: Driver-Rider Collusion Detection
// ═══════════════════════════════════════════════════════════════════════════

export async function checkCollusion(driverId: string, riderId: string): Promise<FraudCheckResult> {
  const svc = createServiceClient();
  const windowStart = new Date(Date.now() - COLLUSION_WINDOW_DAYS * 86400000).toISOString();

  // Check pair frequency
  const { data: pair } = await svc
    .from('ride_pair_counts')
    .select('ride_count, last_ride_at')
    .eq('driver_id', driverId)
    .eq('rider_id', riderId)
    .maybeSingle();

  let score = 0;
  let detail = 'No previous trips between this pair';

  if (pair) {
    const count = pair.ride_count ?? 0;
    if (count >= COLLUSION_PAIR_THRESHOLD) {
      score = Math.min(100, count * 15);
      detail = `Same driver-rider pair: ${count} trips in ${COLLUSION_WINDOW_DAYS} days (threshold: ${COLLUSION_PAIR_THRESHOLD})`;
    } else {
      detail = `Pair count: ${count} (below threshold)`;
    }
  }

  // Update pair count
  await svc.from('ride_pair_counts').upsert({
    driver_id: driverId,
    rider_id: riderId,
    ride_count: (pair?.ride_count ?? 0) + 1,
    last_ride_at: new Date().toISOString(),
  }, { onConflict: 'driver_id,rider_id' });

  return {
    check: 'collusion',
    score,
    weight: 0.1,
    passed: score < 30,
    detail,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK 8: Real-Time Fraud Score Aggregation
// ═══════════════════════════════════════════════════════════════════════════

export function aggregateScore(checks: FraudCheckResult[]): FraudAssessment {
  // Weighted score: sum(check.score * check.weight) / sum(weights)
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = checks.reduce((sum, c) => sum + c.score * c.weight, 0);
  const totalScore = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);

  const failedChecks = checks.filter(c => !c.passed);
  const reasons = failedChecks.map(c => `[${c.check}] ${c.detail}`);

  let action: 'allow' | 'flag' | 'cancel' | 'ban' = 'allow';
  if (totalScore >= SCORE_CANCEL) action = 'cancel';
  else if (totalScore >= SCORE_FLAG) action = 'flag';

  // Any banned device = immediate ban
  if (checks.some(c => c.check === 'device_ban' && c.score >= 100)) {
    action = 'ban';
  }

  return { totalScore, checks, action, reasons };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: Assess Trip Fraud
// ═══════════════════════════════════════════════════════════════════════════

export async function assessTripFraud(
  trip: TripData,
  options?: {
    locationHistory?: LocationPoint[];
    driverLocation?: { lat: number; lng: number };
    riderLocation?: { lat: number; lng: number };
    deviceFingerprint?: string;
    ipAddress?: string;
  },
): Promise<FraudAssessment> {
  const checks: FraudCheckResult[] = [];

  // 1. GPS spoofing
  if (options?.locationHistory && options.locationHistory.length >= 2) {
    checks.push(checkGpsSpoofing(options.locationHistory));
  }

  // 2. Minimum trip
  checks.push(checkMinimumTrip(trip.distanceKm, trip.durationMin * 60));

  // 3. Route deviation
  if (trip.estimatedDistanceKm) {
    checks.push(checkRouteDeviation(trip.distanceKm, trip.estimatedDistanceKm));
  }

  // 4. Pickup proximity
  if (options?.driverLocation) {
    checks.push(checkProximity(
      { lat: trip.pickupLat, lng: trip.pickupLng },
      options.driverLocation,
      'pickup',
    ));
  }

  // 5. Device ban
  checks.push(await checkDeviceBan(options?.deviceFingerprint ?? null, options?.ipAddress ?? null));

  // 6. Account reuse
  checks.push(await checkAccountReuse(trip.riderId));

  // 7. Collusion
  if (trip.driverId) {
    checks.push(await checkCollusion(trip.driverId, trip.riderId));
  }

  // 8. Aggregate score
  const assessment = aggregateScore(checks);

  // Log to database
  const svc = createServiceClient();
  await svc.from('trip_fraud_scores').insert({
    ride_id: trip.rideId,
    score: assessment.totalScore,
    checks: assessment.checks,
    flagged: assessment.action === 'flag' || assessment.action === 'cancel',
    auto_cancelled: assessment.action === 'cancel',
  });

  // Log fraud event if suspicious
  if (assessment.action !== 'allow') {
    await svc.from('fraud_events').insert({
      user_id: trip.riderId,
      ride_id: trip.rideId,
      driver_id: trip.driverId,
      event_type: `trip_${assessment.action}`,
      severity: assessment.action === 'cancel' || assessment.action === 'ban' ? 'critical' : 'high',
      fraud_score: assessment.totalScore,
      details: { checks: assessment.checks, reasons: assessment.reasons },
      device_fingerprint: options?.deviceFingerprint,
      ip_address: options?.ipAddress,
      action_taken: assessment.action,
    });

    // Sentry alert
    Sentry.captureMessage(`Fraud detected: trip ${assessment.action} (score ${assessment.totalScore})`, {
      level: assessment.action === 'cancel' || assessment.action === 'ban' ? 'error' : 'warning',
      tags: {
        component: 'fraud',
        action: assessment.action,
        rideId: trip.rideId,
        score: String(assessment.totalScore),
      },
      extra: { checks: assessment.checks, reasons: assessment.reasons },
    });
  }

  return assessment;
}

// ═══════════════════════════════════════════════════════════════════════════
// BAN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

export async function banDevice(
  fingerprint: string,
  reason: string,
  userId?: string,
  ip?: string,
): Promise<void> {
  const svc = createServiceClient();
  await svc.from('device_bans').upsert({
    device_fingerprint: fingerprint,
    ip_address: ip,
    user_id: userId,
    reason,
    banned_by: 'system',
  }, { onConflict: 'device_fingerprint' });

  Sentry.captureMessage(`Device banned: ${fingerprint}`, {
    level: 'warning',
    tags: { component: 'fraud', action: 'ban' },
    extra: { reason, userId, ip },
  });
}

export async function isDeviceBanned(fingerprint: string): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('device_bans')
    .select('id')
    .eq('device_fingerprint', fingerprint)
    .maybeSingle();
  return !!data;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT FRAUD ASSESSMENT (for registration/login)
// ═══════════════════════════════════════════════════════════════════════════

export async function assessAccountFraud(
  userId: string,
  options?: {
    phone?: string;
    email?: string;
    deviceFingerprint?: string;
    ipAddress?: string;
  },
): Promise<FraudAssessment> {
  const checks: FraudCheckResult[] = [];

  // Device ban check
  checks.push(await checkDeviceBan(options?.deviceFingerprint ?? null, options?.ipAddress ?? null));

  // Account reuse
  checks.push(await checkAccountReuse(userId, options?.phone, options?.email, options?.deviceFingerprint));

  // Store identifier for future lookups
  const svc = createServiceClient();
  if (options?.phone) {
    await svc.from('account_identifiers').upsert({
      user_id: userId,
      identifier_type: 'phone',
      identifier_value: options.phone,
      device_fingerprint: options?.deviceFingerprint,
    });
  }
  if (options?.deviceFingerprint) {
    await svc.from('account_identifiers').upsert({
      user_id: userId,
      identifier_type: 'device',
      identifier_value: options.deviceFingerprint,
      device_fingerprint: options.deviceFingerprint,
    });
  }

  return aggregateScore(checks);
}
