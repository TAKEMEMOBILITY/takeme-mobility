import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/health
//
// Lightweight health check. Use as Render health check path to prevent
// the free tier from sleeping, and to verify the app is responding.
//
// Returns env var availability status (not values) for debugging.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY,
      stripePub: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      googleMaps: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
  });
}
