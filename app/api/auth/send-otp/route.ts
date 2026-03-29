import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendVerification } from '@/lib/twilio';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/send-otp
// Sends OTP to phone via Twilio Verify.
// ═══════════════════════════════════════════════════════════════════════════

const schema = z.object({
  phone: z.string().regex(/^\+1\d{10}$/, 'Must be a valid US phone: +1XXXXXXXXXX'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Validate input
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch (err) {
      const msg = err instanceof z.ZodError
        ? err.issues[0]?.message || 'Invalid phone number'
        : 'Invalid request';
      console.error('[send-otp] Validation failed:', msg);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 2. Check env vars
    const hasSid = !!process.env.TWILIO_ACCOUNT_SID;
    const hasToken = !!process.env.TWILIO_AUTH_TOKEN;
    const hasService = !!process.env.TWILIO_VERIFY_SERVICE_SID;

    console.log('[send-otp] Phone:', body.phone);
    console.log('[send-otp] Env check — SID:', hasSid, 'Token:', hasToken, 'ServiceSID:', hasService);

    if (!hasSid || !hasToken || !hasService) {
      const missing = [
        !hasSid && 'TWILIO_ACCOUNT_SID',
        !hasToken && 'TWILIO_AUTH_TOKEN',
        !hasService && 'TWILIO_VERIFY_SERVICE_SID',
      ].filter(Boolean).join(', ');
      console.error('[send-otp] Missing env vars:', missing);
      return NextResponse.json({
        error: `SMS service not configured. Missing: ${missing}`,
      }, { status: 503 });
    }

    // 3. Send via Twilio Verify
    console.log('[send-otp] Calling Twilio Verify for:', body.phone);
    const result = await sendVerification(body.phone);

    if (!result.success) {
      console.error('[send-otp] Twilio error:', result.error);
      return NextResponse.json({
        error: result.error || 'Failed to send verification code',
      }, { status: 400 });
    }

    console.log('[send-otp] SMS sent successfully to:', body.phone);
    return NextResponse.json({ sent: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[send-otp] Unhandled error:', message);
    return NextResponse.json({
      error: `Verification service error: ${message}`,
    }, { status: 500 });
  }
}
