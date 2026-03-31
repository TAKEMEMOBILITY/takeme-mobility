import { NextRequest, NextResponse } from 'next/server';
import { processDispatchQueue } from '@/lib/dispatch-queue';
import { getDispatchQueueLength } from '@/lib/redis';

// GET /api/dispatch/worker
// Processes pending dispatch queue items. Called by:
// - Vercel Cron (every 1 minute, sends GET with Authorization header)
// - Manual trigger
//
// Protected by CRON_SECRET to prevent unauthorized calls.

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow unauthenticated health check (returns queue length only)
    try {
      const queueLength = await getDispatchQueueLength();
      return NextResponse.json({ queueLength, status: 'ready' });
    } catch {
      return NextResponse.json({ error: 'Redis unavailable' }, { status: 500 });
    }
  }

  // Authenticated — process the queue
  try {
    const queueLength = await getDispatchQueueLength();
    if (queueLength === 0) {
      return NextResponse.json({ processed: 0, message: 'Queue empty' });
    }

    const result = await processDispatchQueue(10);
    console.log(`[dispatch-worker] Processed ${result.processed}: ${result.assigned} assigned, ${result.failed} failed`);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[dispatch-worker] Error:', err);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}

// POST also works (for QStash or manual triggers)
export async function POST(request: NextRequest) {
  return GET(request);
}
