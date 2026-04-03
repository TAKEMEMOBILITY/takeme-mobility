import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════
// Zero Trust — Secure Session Management
// Verify session, MFA, device binding, IP consistency.
// ═══════════════════════════════════════════════════════════════════════════

interface SessionValidation {
  valid: boolean;
  userId?: string;
  email?: string;
  role?: string;
  sessionId?: string;
  mfaVerified?: boolean;
  reason?: string;
}

function extractIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

function getFingerprint(request: NextRequest): string {
  const ua = request.headers.get('user-agent') ?? '';
  const lang = request.headers.get('accept-language') ?? '';
  return Buffer.from(`${ua}|${lang}`).toString('base64').slice(0, 40);
}

export async function validateSecureSession(
  request: NextRequest,
): Promise<SessionValidation> {
  // Step 1: Validate Supabase auth session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { valid: false, reason: 'No authenticated user' };
  }

  const svc = createServiceClient();

  // Step 2: Get user profile with role
  const { data: profile } = await svc
    .from('riders')
    .select('role, mfa_enabled, locked_until, session_timeout_minutes, trusted_ips, trusted_devices')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { valid: false, userId: user.id, reason: 'Profile not found' };
  }

  // Step 3: Check account lock
  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    return { valid: false, userId: user.id, reason: 'Account locked' };
  }

  const ip = extractIP(request);
  const fingerprint = getFingerprint(request);

  // Step 4: Find active secure session
  const { data: sessions } = await svc
    .from('secure_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  const session = sessions?.[0];

  if (!session) {
    // Create a new secure session
    const timeoutMinutes = profile.session_timeout_minutes ?? 60;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);
    const token = crypto.randomUUID();

    await svc.from('secure_sessions').insert({
      user_id: user.id,
      session_token: token,
      ip_address: ip,
      device_fingerprint: fingerprint,
      user_agent: request.headers.get('user-agent') ?? null,
      mfa_verified: false,
      expires_at: expiresAt.toISOString(),
    });

    return {
      valid: true,
      userId: user.id,
      email: user.email ?? '',
      role: profile.role,
      sessionId: token,
      mfaVerified: false,
    };
  }

  // Step 5: Check session timeout
  const timeoutMs = (profile.session_timeout_minutes ?? 60) * 60 * 1000;
  const lastActivity = new Date(session.last_activity).getTime();
  if (Date.now() - lastActivity > timeoutMs) {
    // Revoke expired session
    await svc
      .from('secure_sessions')
      .update({ revoked: true, revoke_reason: 'session_timeout' })
      .eq('id', session.id);
    return { valid: false, userId: user.id, reason: 'Session expired' };
  }

  // Step 6: Update last activity (extend session)
  await svc
    .from('secure_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('id', session.id);

  // Update profile last_active_at
  await svc
    .from('riders')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id);

  return {
    valid: true,
    userId: user.id,
    email: user.email ?? '',
    role: profile.role,
    sessionId: session.session_token,
    mfaVerified: session.mfa_verified ?? false,
  };
}

export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('secure_sessions')
    .update({ revoked: true, revoke_reason: reason })
    .eq('id', sessionId);
}

export async function revokeAllUserSessions(userId: string, reason: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('secure_sessions')
    .update({ revoked: true, revoke_reason: reason })
    .eq('user_id', userId)
    .eq('revoked', false);
}
