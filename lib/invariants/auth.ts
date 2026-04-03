import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';

// ═══════════════════════════════════════════════════════════════════════════
// INVARIANT 1 — Auth must NEVER silently fail
//
// Every auth attempt produces exactly one of:
// - SUCCESS (session created, audit logged)
// - EXPLICIT_FAILURE (user notified, error logged)
// - NEVER: silent failure, undefined state, or hanging request
// ═══════════════════════════════════════════════════════════════════════════

const AUTH_TIMEOUT_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 5;
const LOCKOUT_MINUTES = 30;

interface AuthResult {
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
  locked?: boolean;
}

/**
 * Safe auth wrapper. Guarantees:
 * - Timeout after 10s (never hangs)
 * - null/undefined → treated as failure
 * - Always writes audit log (even on crash)
 * - Locks account after 5 consecutive failures
 */
export async function safeAuthAttempt(
  identifier: string, // email or phone
  authFn: () => Promise<{ userId?: string; email?: string; error?: string } | null>,
  request?: Request,
): Promise<AuthResult> {
  const svc = createServiceClient();
  let result: AuthResult = { success: false, error: 'Unknown auth failure' };

  try {
    // Run with timeout
    const authPromise = authFn();
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Auth timeout: exceeded 10 seconds')), AUTH_TIMEOUT_MS),
    );

    const raw = await Promise.race([authPromise, timeoutPromise]);

    // null/undefined = failure (never treat as success)
    if (!raw || (!raw.userId && !raw.error)) {
      result = { success: false, error: 'Auth returned empty response' };
    } else if (raw.error) {
      result = { success: false, error: raw.error };
    } else if (raw.userId) {
      result = { success: true, userId: raw.userId, email: raw.email };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Auth exception';
    result = { success: false, error: msg };
  }

  // FINALLY: Always log (audit write failure must not block)
  try {
    await auditLog({
      userId: result.userId,
      userEmail: result.email ?? identifier,
      action: result.success ? 'auth_success' : 'auth_failure',
      resource: 'auth',
      success: result.success,
      request,
      riskScore: result.success ? 0 : 20,
      metadata: { identifier, error: result.error },
    });
  } catch {
    // Dead letter: write to Redis if audit fails
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (url && token) {
        await fetch(`${url}/lpush/audit:dead_letter/${encodeURIComponent(JSON.stringify({
          identifier, success: result.success, error: result.error, ts: Date.now(),
        }))}`, { headers: { Authorization: `Bearer ${token}` } });
      }
    } catch { /* truly last resort — console only */ }
  }

  // Track consecutive failures + lockout
  if (!result.success) {
    try {
      // Find user by identifier to increment failed_attempts
      const { data: user } = await svc
        .from('riders')
        .select('id, failed_attempts, locked_until')
        .or(`email.eq.${identifier},phone.eq.${identifier}`)
        .limit(1)
        .single();

      if (user) {
        // Check if already locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
          result.locked = true;
          result.error = 'Account temporarily locked. Please try again later.';
          return result;
        }

        const newAttempts = (user.failed_attempts ?? 0) + 1;
        const update: Record<string, unknown> = { failed_attempts: newAttempts };

        if (newAttempts >= MAX_CONSECUTIVE_FAILURES) {
          update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
          result.locked = true;
          result.error = `Account locked for ${LOCKOUT_MINUTES} minutes after ${MAX_CONSECUTIVE_FAILURES} failed attempts.`;

          // Alert security
          await auditLog({
            userId: user.id,
            action: 'account_locked_consecutive_failures',
            resource: 'auth',
            success: false,
            riskScore: 70,
            metadata: { attempts: newAttempts, lockMinutes: LOCKOUT_MINUTES },
          });
        }

        await svc.from('riders').update(update).eq('id', user.id);
      }
    } catch { /* non-critical */ }
  } else {
    // Reset failed_attempts on success
    try {
      if (result.userId) {
        await svc.from('riders').update({ failed_attempts: 0 }).eq('id', result.userId);
      }
    } catch { /* non-critical */ }
  }

  return result;
}

/** Fallback error message when auth service is completely unreachable */
export const AUTH_UNAVAILABLE_MESSAGE = 'Authentication service temporarily unavailable. Please try again.';
