import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════
// Auth is handled client-side via Supabase Auth (@/lib/auth/context.tsx).
// This route exists only to prevent 404s if something hits /api/auth/signup.
// No server-side auth logic here — Supabase manages sessions via cookies.
// ═══════════════════════════════════════════════════════════════════════════

export async function POST() {
  return NextResponse.json(
    { error: 'Use the client-side auth flow. This endpoint is not used.' },
    { status: 410 },
  );
}
