import { NextResponse } from 'next/server';
import { getAllMetrics } from '@/lib/invariants/metrics';

// GET /api/invariants/metrics — All invariant metrics
export async function GET() {
  const metrics = await getAllMetrics();
  return NextResponse.json({ timestamp: new Date().toISOString(), metrics });
}
