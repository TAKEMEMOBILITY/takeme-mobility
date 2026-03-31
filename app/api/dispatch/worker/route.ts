import { NextRequest, NextResponse } from 'next/server';
import { processDispatchQueue, processOneDispatch } from '@/lib/dispatch-queue';
import { getDispatchQueueLength, enqueueDispatch } from '@/lib/redis';

// /api/dispatch/worker
// Processes dispatch queue items. Called by:
// - QStash (event-driven, POST with {rideId, attempt} body)
// - Vercel Cron (every 1 minute, GET with CRON_SECRET)
// - Manual trigger
//
// QStash gives sub-5s matching. Cron is the safety net.

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = request.headers.get('authorization');
  // Accept both CRON_SECRET and QStash's Upstash-Signature
  return auth === `Bearer ${cronSecret}` || !!request.headers.get('upstash-signature');
}

// GET — Vercel Cron or health check
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    try {
      const queueLength = await getDispatchQueueLength();
      return NextResponse.json({ queueLength, status: 'ready' });
    } catch {
      return NextResponse.json({ error: 'Redis unavailable' }, { status: 500 });
    }
  }

  try {
    const queueLength = await getDispatchQueueLength();
    if (queueLength === 0) {
      return NextResponse.json({ processed: 0, message: 'Queue empty' });
    }

    const result = await processDispatchQueue(10);
    console.log(`[dispatch-worker] Cron processed ${result.processed}: ${result.assigned} assigned, ${result.failed} failed`);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[dispatch-worker] Cron error:', err);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}

// POST — QStash event-driven dispatch (instant, with rideId in body)
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // QStash sends {rideId, attempt} in the body
    let body: { rideId?: string; attempt?: number } = {};
    try {
      body = await request.json();
    } catch {
      // No body — process from Redis queue instead
    }

    if (body.rideId) {
      // Direct dispatch for a specific ride (from QStash)
      await enqueueDispatch(body.rideId, body.attempt ?? 0);
      const result = await processOneDispatch();
      console.log(`[dispatch-worker] QStash: ride ${body.rideId} → ${result?.assigned ? 'assigned' : 'queued'}`);
      return NextResponse.json(result ?? { processed: 0 });
    }

    // No rideId — process general queue
    const result = await processDispatchQueue(10);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[dispatch-worker] QStash error:', err);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}
