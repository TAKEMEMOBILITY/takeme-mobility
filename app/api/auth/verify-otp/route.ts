import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOTP } from '@/lib/sms';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/verify-otp
//
// 1. Verify OTP code via AWS SNS
// 2. Find or create Supabase user (admin API, service role)
// 3. Generate a real Supabase session (admin.generateLink)
// 4. Set session cookies so it persists across refreshes
//
// Result: real authenticated session. Not fake. Not manual.
// ═══════════════════════════════════════════════════════════════════════════

const schema = z.object({
  phone: z.string().regex(/^\+1\d{10}$/, 'Invalid phone number'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

// Service-role client for admin operations (no cookies needed)
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service config missing');
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

// Cookie-aware client for setting the session
async function getSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !key) throw new Error('Supabase config missing');
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {}
      },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Parse input
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0]?.message || 'Invalid input' : 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 1. Verify OTP via AWS SNS
    const verification = await verifyOTP(body.phone, body.code);
    if (!verification.success) {
      return NextResponse.json({ error: verification.error || 'Invalid or expired code' }, { status: 400 });
    }

    // 2. Find or create Supabase user by phone
    const admin = getAdminClient();
    const syntheticEmail = `${body.phone.replace('+', '')}@sms.takememobility.com`;

    let userId: string;
    let userEmail: string;

    // Try to create user first — if phone already exists, Supabase returns error
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      phone: body.phone,
      email: syntheticEmail,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: { phone: body.phone },
    });

    if (created?.user) {
      // New user created
      userId = created.user.id;
      userEmail = syntheticEmail;
    } else if (createErr?.message?.includes('already been registered') ||
               createErr?.message?.includes('already exists') ||
               createErr?.status === 422) {
      // User exists — look up directly via service role query on auth.users
      // This avoids the O(n) listUsers scan that breaks at scale
      const { data: existingRows } = await admin
        .from('users' as 'users')
        .select('id, phone, email')
        .eq('phone', body.phone)
        .limit(1);

      const existing = (existingRows as { id: string; phone?: string; email?: string }[] | null)?.[0];

      if (!existing) {
        console.error('[verify-otp] User exists but not found');
        return NextResponse.json({ error: 'Account error. Please try again.' }, { status: 500 });
      }

      userId = existing.id;
      userEmail = existing.email || syntheticEmail;

      // Ensure email is set for generateLink
      if (!existing.email) {
        await admin.auth.admin.updateUserById(userId, { email: syntheticEmail });
        userEmail = syntheticEmail;
      }
    } else {
      console.error('[verify-otp] User creation failed:', createErr);
      return NextResponse.json({ error: 'Could not create account.' }, { status: 500 });
    }

    // 3. Generate a magic link to get a real token pair
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('[verify-otp] generateLink failed:', linkErr);
      return NextResponse.json({ error: 'Could not create session.' }, { status: 500 });
    }

    // 4. Use the token to create a real session with cookies
    const sessionClient = await getSessionClient();

    const { error: otpErr } = await sessionClient.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    });

    if (otpErr) {
      console.error('[verify-otp] Session creation failed:', otpErr);
      return NextResponse.json({ error: 'Could not sign in. Please try again.' }, { status: 500 });
    }

    // Session cookies are now set by the sessionClient's setAll callback.
    // The user is fully authenticated.

    return NextResponse.json({
      verified: true,
      userId,
    });

  } catch (err) {
    console.error('POST /api/auth/verify-otp failed:', err);
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}
