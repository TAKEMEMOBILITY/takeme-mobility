import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmailOTP } from '@/lib/email-otp';
import { rateLimit } from '@/lib/rate-limit';

// POST /api/auth/send-email-otp
// Temporary email OTP fallback — remove once AWS SMS Production Access is approved

const schema = z.object({
  email: z.string().email('Must be a valid email address'),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimited = await rateLimit(request, 'send-otp');
    if (rateLimited) return rateLimited;

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch (err) {
      const msg = err instanceof z.ZodError
        ? err.issues[0]?.message || 'Invalid email'
        : 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const result = await sendEmailOTP(body.email);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log('[send-email-otp] Code sent to:', body.email);
    return NextResponse.json({ sent: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[send-email-otp] Error:', message);
    return NextResponse.json({ error: `Email service error: ${message}` }, { status: 500 });
  }
}
