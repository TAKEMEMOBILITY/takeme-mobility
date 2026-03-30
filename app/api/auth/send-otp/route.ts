import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendOTP } from '@/lib/sms';

// POST /api/auth/send-otp
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

    // 2. Send OTP via AWS SNS
    const result = await sendOTP(body.phone);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
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
