// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — Dispatch Queue
// Retries driver assignment with exponential backoff.
// Times out after MAX_WAIT_MS and marks ride as no_drivers_found.
// ═══════════════════════════════════════════════════════════════════════════

import { assignDriver } from '@/lib/dispatch';
import { createServiceClient } from '@/lib/supabase/service';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 3000;    // 3s, 6s, 12s, 24s, 48s
const MAX_WAIT_MS = 120_000;   // 2 minutes total timeout

interface DispatchQueueResult {
  assigned: boolean;
  driverName?: string;
  retries: number;
  error?: string;
}

/**
 * Dispatches a ride with retry logic. Non-blocking — fire and forget.
 * Updates the ride status in DB on success or timeout.
 */
export async function dispatchWithRetry(rideId: string): Promise<DispatchQueueResult> {
  const startTime = Date.now();
  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Check timeout
    if (Date.now() - startTime > MAX_WAIT_MS) break;

    // Check ride is still searching (rider may have cancelled)
    const supabase = createServiceClient();
    const { data: ride } = await supabase
      .from('rides')
      .select('status')
      .eq('id', rideId)
      .single();

    if (!ride || ride.status !== 'searching_driver') {
      return { assigned: false, retries: attempt, error: 'Ride no longer searching' };
    }

    // Attempt assignment
    const result = await assignDriver(rideId);

    if (result.success && result.driver) {
      console.log(`[dispatch-queue] Ride ${rideId} assigned to ${result.driver.driver_name} after ${attempt + 1} attempt(s)`);
      return {
        assigned: true,
        driverName: result.driver.driver_name,
        retries: attempt + 1,
      };
    }

    lastError = result.error ?? 'No drivers available';

    // Wait with exponential backoff before retrying
    if (attempt < MAX_RETRIES - 1) {
      const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), 30_000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted — mark ride as timed out
  const supabase = createServiceClient();
  await supabase
    .from('rides')
    .update({ status: 'cancelled', cancelled_reason: 'no_drivers_available' })
    .eq('id', rideId)
    .eq('status', 'searching_driver'); // only if still searching

  await supabase.from('ride_events').insert({
    ride_id: rideId,
    event_type: 'dispatch_timeout',
    new_status: 'cancelled',
    old_status: 'searching_driver',
    actor: 'system',
    metadata: { reason: lastError, max_retries: MAX_RETRIES },
  });

  console.warn(`[dispatch-queue] Ride ${rideId} timed out after ${MAX_RETRIES} retries`);

  return {
    assigned: false,
    retries: MAX_RETRIES,
    error: `No drivers found after ${MAX_RETRIES} attempts`,
  };
}
