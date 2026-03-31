import { NextRequest, NextResponse } from 'next/server';
import { processDispatchQueue } from '@/lib/dispatch-queue';
import { getDispatchQueueLength } from '@/lib/redis';

// POST /api/dispatch/worker
// Processes pending dispatch queue items. Called by:
// - Vercel Cron (every 10 seconds)
// - QStash webhook
// - Manual trigger
//
// Protected by CRON_SECRET to prevent unauthorized calls.

export async function POST(request: NextRequest) {
  // Verify cron secret (optional — skip in dev)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

// GET for health check / manual trigger in dev
export async function GET() {
  try {
    const queueLength = await getDispatchQueueLength();
    return NextResponse.json({ queueLength, status: 'ready' });
  } catch (err) {
    return NextResponse.json({ error: 'Redis unavailable' }, { status: 500 });
  }
}
