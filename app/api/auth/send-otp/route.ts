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
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch (err) {
      const msg = err instanceof z.ZodError
        ? err.issues[0]?.message || 'Invalid phone number'
        : 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const result = await sendVerification(body.phone);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('POST /api/auth/send-otp failed:', err);
    return NextResponse.json({ error: 'Could not send verification code.' }, { status: 500 });
  }
}
