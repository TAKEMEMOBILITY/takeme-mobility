import { createServiceClient } from '@/lib/supabase/service';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// ═══════════════════════════════════════════════════════════════════════════
// Zero Trust — Reaction Engine
//
// Runs AFTER every audit log write. If risk_score threshold is crossed,
// automatic response fires. No human needed.
//
// - Never blocks the original request (async fire-and-forget)
// - Never throws (logs failures to audit_logs)
// - Idempotent (running twice = same effect)
// - 10-minute cooldown on duplicate alerts
// ═══════════════════════════════════════════════════════════════════════════

const ALERT_EMAIL = 'acilholding@gmail.com';
const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'noreply@takememobility.com';
const ADMIN_PHONE = process.env.ADMIN_PHONE_NUMBER;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://takememobility.com';
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// In-memory cooldown tracker (per-user per-reaction)
const cooldowns = new Map<string, number>();

function isOnCooldown(key: string): boolean {
  const last = cooldowns.get(key);
  if (!last) return false;
  if (Date.now() - last < COOLDOWN_MS) return true;
  cooldowns.delete(key);
  return false;
}

function setCooldown(key: string): void {
  cooldowns.set(key, Date.now());
  // Prune old entries every 100 inserts
  if (cooldowns.size > 200) {
    const now = Date.now();
    for (const [k, v] of cooldowns) {
      if (now - v > COOLDOWN_MS) cooldowns.delete(k);
    }
  }
}

function getAWSConfig() {
  return {
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  };
}

async function sendAlertEmail(subject: string, body: string): Promise<void> {
  try {
    const ses = new SESClient(getAWSConfig());
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [ALERT_EMAIL] },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: body } },
      },
    }));
  } catch (e) {
    console.error('[reaction] Email alert failed:', (e as Error).message);
  }
}

async function sendAlertSMS(message: string): Promise<void> {
  if (!ADMIN_PHONE) return;
  try {
    const sns = new SNSClient(getAWSConfig());
    await sns.send(new PublishCommand({ PhoneNumber: ADMIN_PHONE, Message: message }));
  } catch (e) {
    console.error('[reaction] SMS alert failed:', (e as Error).message);
  }
}

async function logReaction(
  svc: ReturnType<typeof createServiceClient>,
  userId: string | undefined,
  userEmail: string | undefined,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await svc.from('audit_logs').insert({
      user_id: userId ?? null,
      user_email: userEmail ?? null,
      action,
      resource: 'reaction_engine',
      success: true,
      risk_score: 0,
      metadata,
    });
  } catch (e) {
    console.error('[reaction] Failed to log reaction:', (e as Error).message);
  }
}

// ── Check for repeat offender pattern ────────────────────────────────────

async function checkRepeatPattern(
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { data, error } = await svc
    .from('audit_logs')
    .select('id')
    .eq('user_id', userId)
    .gt('risk_score', 50)
    .gte('created_at', oneHourAgo);

  if (error) return false;
  return (data?.length ?? 0) >= 3;
}

// ── Reaction handlers ────────────────────────────────────────────────────

async function handleMediumRisk(
  svc: ReturnType<typeof createServiceClient>,
  userId: string | undefined,
  userEmail: string | undefined,
  riskScore: number,
  context: Record<string, unknown>,
): Promise<void> {
  const cooldownKey = `medium:${userId ?? 'anon'}`;
  if (isOnCooldown(cooldownKey)) return;
  setCooldown(cooldownKey);

  // Increment failed_attempts
  if (userId) {
    try {
      const { data } = await svc.from('riders').select('failed_attempts').eq('id', userId).single();
      if (data) {
        await svc.from('riders').update({ failed_attempts: (data.failed_attempts ?? 0) + 1 }).eq('id', userId);
      }
    } catch { /* non-critical */ }
  }

  await sendAlertEmail(
    `[TakeMe SECURITY] Medium risk activity (score: ${riskScore})`,
    [
      `Risk Score: ${riskScore}`,
      `User: ${userEmail ?? 'unknown'}`,
      `User ID: ${userId ?? 'unknown'}`,
      `Action: ${context.action ?? 'unknown'}`,
      `Resource: ${context.resource ?? 'unknown'}`,
      `Time: ${new Date().toISOString()}`,
      '',
      `Dashboard: ${APP_URL}/security`,
    ].join('\n'),
  );

  await logReaction(svc, userId, userEmail, 'AUTO_ALERT', { riskScore, ...context });
}

async function handleHighRisk(
  svc: ReturnType<typeof createServiceClient>,
  userId: string | undefined,
  userEmail: string | undefined,
  riskScore: number,
  context: Record<string, unknown>,
): Promise<void> {
  const cooldownKey = `high:${userId ?? 'anon'}`;
  if (isOnCooldown(cooldownKey)) return;
  setCooldown(cooldownKey);

  // Force logout: revoke all sessions
  if (userId) {
    await svc
      .from('secure_sessions')
      .update({ revoked: true, revoke_reason: 'high_risk_auto_revoke' })
      .eq('user_id', userId)
      .eq('revoked', false);

    // Lock account for 30 minutes
    const lockUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await svc.from('riders').update({
      locked_until: lockUntil,
      failed_attempts: 0,
    }).eq('id', userId);
  }

  // Send urgent alerts
  await sendAlertEmail(
    `[TakeMe CRITICAL] High risk — user force-logged out (score: ${riskScore})`,
    [
      `AUTOMATIC ACTION: Force logout + 30-minute account lock`,
      '',
      `Risk Score: ${riskScore}`,
      `User: ${userEmail ?? 'unknown'}`,
      `User ID: ${userId ?? 'unknown'}`,
      `Action: ${context.action ?? 'unknown'}`,
      `Resource: ${context.resource ?? 'unknown'}`,
      `Time: ${new Date().toISOString()}`,
      '',
      `Review: ${APP_URL}/security`,
    ].join('\n'),
  );

  await sendAlertSMS(
    `[TakeMe] HIGH RISK: ${userEmail ?? userId ?? 'unknown'} force-logged out. Score: ${riskScore}. Check /security`,
  );

  await logReaction(svc, userId, userEmail, 'AUTO_FORCE_LOGOUT', {
    riskScore, lockDuration: '30m', ...context,
  });
}

async function handleCriticalRisk(
  svc: ReturnType<typeof createServiceClient>,
  userId: string | undefined,
  userEmail: string | undefined,
  riskScore: number,
  ip: string | undefined,
  context: Record<string, unknown>,
): Promise<void> {
  const cooldownKey = `critical:${userId ?? 'anon'}`;
  if (isOnCooldown(cooldownKey)) return;
  setCooldown(cooldownKey);

  // Force logout: revoke all sessions
  if (userId) {
    await svc
      .from('secure_sessions')
      .update({ revoked: true, revoke_reason: 'critical_risk_auto_lock' })
      .eq('user_id', userId)
      .eq('revoked', false);

    // Lock account for 24 hours
    const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await svc.from('riders').update({
      locked_until: lockUntil,
      failed_attempts: 0,
    }).eq('id', userId);
  }

  // Block IP if available
  if (ip && ip !== 'unknown') {
    // Check if IP is already blocked
    const { data: existing } = await svc
      .from('ip_allowlist')
      .select('id')
      .eq('ip_cidr', ip)
      .eq('description', 'AUTO_BLOCKED')
      .limit(1);

    if (!existing || existing.length === 0) {
      await svc.from('ip_allowlist').insert({
        ip_cidr: ip,
        description: 'AUTO_BLOCKED',
        allowed_roles: [],  // Empty = blocked
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  // Create critical incident
  await svc.from('monitoring_alerts').insert({
    service: 'security_reaction_engine',
    error: `Critical risk score ${riskScore} for user ${userEmail ?? userId ?? 'unknown'}`,
    severity: 'critical',
  });

  // Send critical alerts
  await sendAlertEmail(
    `[TakeMe CRITICAL] Account locked — possible breach (score: ${riskScore})`,
    [
      `AUTOMATIC ACTIONS:`,
      `  - All sessions revoked`,
      `  - Account locked for 24 hours`,
      `  - IP ${ip ?? 'unknown'} blocked`,
      `  - Critical incident created`,
      '',
      `Risk Score: ${riskScore}`,
      `User: ${userEmail ?? 'unknown'}`,
      `User ID: ${userId ?? 'unknown'}`,
      `Action: ${context.action ?? 'unknown'}`,
      `Resource: ${context.resource ?? 'unknown'}`,
      `Time: ${new Date().toISOString()}`,
      '',
      `IMMEDIATE ACTION REQUIRED: ${APP_URL}/security`,
    ].join('\n'),
  );

  await sendAlertSMS(
    `[TakeMe CRITICAL] Account ${userEmail ?? 'unknown'} LOCKED. Score: ${riskScore}. IP blocked. Review NOW: /security`,
  );

  await logReaction(svc, userId, userEmail, 'AUTO_ACCOUNT_LOCK', {
    riskScore, lockDuration: '24h', blockedIP: ip, ...context,
  });
}

// ── Main entry point ─────────────────────────────────────────────────────

export async function react(
  userId: string | undefined,
  riskScore: number,
  context: {
    action?: string;
    resource?: string;
    ip?: string;
    userEmail?: string;
    [key: string]: unknown;
  },
): Promise<void> {
  // Only react to scores above threshold
  if (riskScore < 60) return;

  try {
    const svc = createServiceClient();
    let effectiveScore = riskScore;

    // Check repeat offender pattern: 3+ events with score >50 in 1 hour
    if (userId) {
      const isRepeat = await checkRepeatPattern(svc, userId);
      if (isRepeat && effectiveScore < 90) {
        effectiveScore = 90;
        await logReaction(svc, userId, context.userEmail, 'AUTO_PATTERN_LOCK', {
          originalScore: riskScore,
          escalatedScore: 90,
          reason: '3+ high-risk events in 1 hour',
          ...context,
        });
      }
    }

    if (effectiveScore >= 90) {
      await handleCriticalRisk(svc, userId, context.userEmail, effectiveScore, context.ip, context);
    } else if (effectiveScore >= 75) {
      await handleHighRisk(svc, userId, context.userEmail, effectiveScore, context);
    } else {
      await handleMediumRisk(svc, userId, context.userEmail, effectiveScore, context);
    }
  } catch (err) {
    // Reaction engine must never throw — log failure
    console.error('[reaction] Engine error:', (err as Error).message);
    try {
      const svc = createServiceClient();
      await svc.from('audit_logs').insert({
        user_id: userId ?? null,
        action: 'REACTION_ENGINE_ERROR',
        resource: 'reaction_engine',
        success: false,
        risk_score: 0,
        metadata: { error: (err as Error).message, originalScore: riskScore },
      });
    } catch { /* truly last resort — just console */ }
  }
}

// ── Auto-mode escalation (called from /api/monitor after health checks) ──

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function getSystemMode(): Promise<string> {
  if (!REDIS_URL || !REDIS_TOKEN) return 'NORMAL';
  try {
    const res = await fetch(`${REDIS_URL}/get/system:mode`, { headers: { 'Authorization': `Bearer ${REDIS_TOKEN}` } });
    const body = await res.json();
    return body.result ?? 'NORMAL';
  } catch { return 'NORMAL'; }
}

async function setSystemMode(mode: string): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  await fetch(`${REDIS_URL}/set/system:mode/${mode}/ex/86400`, { headers: { 'Authorization': `Bearer ${REDIS_TOKEN}` } });
}

export async function checkModeEscalation(
  failures: Array<{ service: string; status: string }>,
  maxRiskScore: number,
): Promise<void> {
  try {
    const currentMode = await getSystemMode();
    const failedServices = new Set(failures.filter(f => f.status === 'error').map(f => f.service));
    let newMode: string | null = null;

    // Rule: risk_score > 90 → LOCKDOWN
    if (maxRiskScore > 90 && currentMode !== 'LOCKDOWN') {
      newMode = 'LOCKDOWN';
    }
    // Rule: DB or Auth fails → DEFENSIVE
    else if ((failedServices.has('supabase_db') || failedServices.has('supabase_auth')) && currentMode !== 'LOCKDOWN' && currentMode !== 'DEFENSIVE') {
      newMode = 'DEFENSIVE';
    }
    // Rule: 3+ services fail → DEGRADED
    else if (failedServices.size >= 3 && currentMode === 'NORMAL') {
      newMode = 'DEGRADED';
    }

    if (newMode && newMode !== currentMode) {
      await setSystemMode(newMode);

      const svc = createServiceClient();
      await logReaction(svc, undefined, undefined, 'AUTO_MODE_CHANGE', {
        from: currentMode,
        to: newMode,
        trigger: maxRiskScore > 90 ? 'high_risk_score' : failedServices.size >= 3 ? 'multi_service_failure' : 'critical_service_failure',
        failedServices: [...failedServices],
      });

      await sendAlertEmail(
        `[TakeMe] AUTO MODE CHANGE: ${currentMode} → ${newMode}`,
        `System automatically escalated from ${currentMode} to ${newMode}.\n\nFailing services: ${[...failedServices].join(', ')}\nMax risk score: ${maxRiskScore}\nTime: ${new Date().toISOString()}\n\nReview: ${APP_URL}/ops`,
      );
      await sendAlertSMS(`[TakeMe] MODE: ${currentMode} → ${newMode}. ${failedServices.size} services down. Check /ops NOW`);
    }
  } catch (e) {
    console.error('[reaction] Mode escalation error:', (e as Error).message);
  }
}
