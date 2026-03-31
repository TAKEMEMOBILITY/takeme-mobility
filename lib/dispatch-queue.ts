// ═══════════════════════════════════════════════════════════════════════════
// TAKEME MOBILITY — Persistent Dispatch Queue
// Redis-backed queue with API-triggered processing.
// Survives Vercel serverless timeouts (unlike in-memory retry loops).
//
// Flow:
// 1. Ride created → enqueueDispatch(rideId)
// 2. Cron/API → processDispatchQueue() picks items, runs assignDriver()
// 3. On success → push notification to driver
// 4. On failure → re-enqueue with incremented attempt (max 5)
// 5. On max retries → cancel ride, notify rider
// ═══════════════════════════════════════════════════════════════════════════

import { assignDriver } from '@/lib/dispatch';
import { createServiceClient } from '@/lib/supabase/service';
import { enqueueDispatch, dequeueDispatch } from '@/lib/redis';
import { sendPushNotification, rideRequestNotification } from '@/lib/push';

const MAX_RETRIES = 5;

interface DispatchQueueResult {
  assigned: boolean;
  driverName?: string;
  retries: number;
  error?: string;
}

/**
 * Enqueue a ride for dispatch. Called from rides/create route.
 */
export async function queueRideForDispatch(rideId: string): Promise<void> {
  await enqueueDispatch(rideId, 0);
}

/**
 * Process one item from the dispatch queue.
 * Called by the dispatch worker API endpoint or cron job.
 */
export async function processOneDispatch(): Promise<DispatchQueueResult | null> {
  const item = await dequeueDispatch();
  if (!item) return null;

  const { rideId, attempt } = item;
  const supabase = createServiceClient();

  // Check ride is still searching
  const { data: ride } = await supabase
    .from('rides')
    .select('status, pickup_address, dropoff_address, estimated_fare, distance_km')
    .eq('id', rideId)
    .single();

  if (!ride || ride.status !== 'searching_driver') {
    return { assigned: false, retries: attempt, error: 'Ride no longer searching' };
  }

  // Attempt assignment
  const result = await assignDriver(rideId);

  if (result.success && result.driver) {
    console.log(`[dispatch-queue] Ride ${rideId} → ${result.driver.driver_name} (attempt ${attempt + 1})`);

    // Send push notification to assigned driver
    const { data: pushToken } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', result.driver.driver_id)
      .eq('role', 'driver')
      .single();

    if (pushToken?.token) {
      await sendPushNotification(rideRequestNotification(pushToken.token, {
        rideId,
        pickupAddress: ride.pickup_address,
        dropoffAddress: ride.dropoff_address,
        estimatedFare: Number(ride.estimated_fare),
        distanceKm: Number(ride.distance_km),
      }));
    }

    return { assigned: true, driverName: result.driver.driver_name, retries: attempt + 1 };
  }

  // Failed — re-enqueue or give up
  if (attempt + 1 >= MAX_RETRIES) {
    // Max retries exhausted — cancel ride
    await supabase
      .from('rides')
      .update({ status: 'cancelled', cancelled_reason: 'no_drivers_available' })
      .eq('id', rideId)
      .eq('status', 'searching_driver');

    await supabase.from('ride_events').insert({
      ride_id: rideId,
      event_type: 'dispatch_timeout',
      new_status: 'cancelled',
      old_status: 'searching_driver',
      actor: 'system',
      metadata: { reason: result.error, max_retries: MAX_RETRIES },
    });

    // Notify rider that no drivers found
    const { data: rideData } = await supabase
      .from('rides')
      .select('rider_id')
      .eq('id', rideId)
      .single();

    if (rideData?.rider_id) {
      const { data: riderPush } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', rideData.rider_id)
        .eq('role', 'rider')
        .single();

      if (riderPush?.token) {
        await sendPushNotification({
          to: riderPush.token,
          title: 'No Drivers Available',
          body: 'We couldn\'t find a driver for your ride. Please try again.',
          data: { type: 'dispatch_failed', rideId },
        });
      }
    }

    console.warn(`[dispatch-queue] Ride ${rideId} cancelled after ${MAX_RETRIES} retries`);
    return { assigned: false, retries: MAX_RETRIES, error: 'No drivers found' };
  }

  // Re-enqueue with exponential backoff delay via attempt counter
  await enqueueDispatch(rideId, attempt + 1);
  return { assigned: false, retries: attempt + 1, error: result.error };
}

/**
 * Process all pending items in the queue (up to a limit).
 * Called by the dispatch worker cron endpoint.
 */
export async function processDispatchQueue(maxItems: number = 10): Promise<{
  processed: number;
  assigned: number;
  failed: number;
}> {
  let processed = 0;
  let assigned = 0;
  let failed = 0;

  for (let i = 0; i < maxItems; i++) {
    const result = await processOneDispatch();
    if (!result) break; // queue empty

    processed++;
    if (result.assigned) assigned++;
    else failed++;
  }

  return { processed, assigned, failed };
}

// Legacy export for backward compatibility with rides/create
export async function dispatchWithRetry(rideId: string): Promise<DispatchQueueResult> {
  // First try synchronously
  const result = await assignDriver(rideId);
  if (result.success && result.driver) {
    return { assigned: true, driverName: result.driver.driver_name, retries: 1 };
  }

  // Enqueue for background processing
  await queueRideForDispatch(rideId);
  return { assigned: false, retries: 0, error: 'Queued for background dispatch' };
}
