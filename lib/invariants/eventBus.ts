import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';
import { PRIORITY_CONFIG, type InvariantPriority, type InvariantName } from './priorities';
import { isInShadowMode } from './shadowMode';
import { recordViolationMetric, recordNearMissMetric } from './metrics';

// ═══════════════════════════════════════════════════════════════════════════
// Invariant Event Bus — Global violation dispatcher
//
// CRITICAL → block + escalate mode + SMS + email
// HIGH → escalate to DEGRADED + email
// MEDIUM → log + email ops_core
// Shadow mode → log only, never block
// ═══════════════════════════════════════════════════════════════════════════

export interface InvariantEvent {
  invariant: InvariantName;
  priority: InvariantPriority;
  violation: string;
  context: Record<string, unknown>;
  timestamp: string;
  autoResolved: boolean;
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const rh = () => ({ Authorization: `Bearer ${REDIS_TOKEN!}` });

async function getSystemMode(): Promise<string> {
  if (!REDIS_URL || !REDIS_TOKEN) return 'NORMAL';
  try {
    const res = await fetch(`${REDIS_URL}/get/system:mode`, { headers: rh() });
    const body = await res.json();
    return body.result ?? 'NORMAL';
  } catch { return 'NORMAL'; }
}

async function setSystemMode(mode: string): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  await fetch(`${REDIS_URL}/set/system:mode/${mode}/ex/86400`, { headers: rh() }).catch(() => {});
}

/**
 * Emit an invariant violation event. Central dispatch for all invariant violations.
 * Returns whether the operation should be blocked.
 */
export async function emitViolation(event: InvariantEvent): Promise<{ blocked: boolean }> {
  const config = PRIORITY_CONFIG[event.priority];
  const shadow = await isInShadowMode(event.invariant);
  const svc = createServiceClient();
  const modeBefore = await getSystemMode();

  // Record metric
  if (shadow) {
    await recordViolationMetric(event.invariant, true);
  } else {
    await recordViolationMetric(event.invariant, false);
  }

  // Write to invariant_violations table (always, even in shadow)
  let modeAfter = modeBefore;
  try {
    // Escalate mode (only if not shadow)
    if (!shadow && config.escalateMode) {
      const modes = ['NORMAL', 'DEGRADED', 'DEFENSIVE', 'LOCKDOWN'];
      const currentIdx = modes.indexOf(modeBefore);
      const targetIdx = modes.indexOf(config.escalateMode);
      if (targetIdx > currentIdx) {
        modeAfter = config.escalateMode;
        await setSystemMode(modeAfter);
      } else if (event.priority === 'CRITICAL' && modeBefore === 'DEFENSIVE') {
        modeAfter = 'LOCKDOWN';
        await setSystemMode('LOCKDOWN');
      }
    }

    await svc.from('invariant_violations').insert({
      invariant: event.invariant,
      priority: event.priority,
      violation: event.violation,
      context: event.context,
      auto_resolved: event.autoResolved,
      system_mode_before: modeBefore,
      system_mode_after: modeAfter,
      shadow,
    });
  } catch (e) {
    console.error('[eventBus] Failed to write violation:', (e as Error).message);
  }

  // Shadow mode: log only, never block/escalate/alert
  if (shadow) {
    // Notify ops_core only (low urgency)
    sendAlertEmail(
      `[TakeMe SHADOW] ${event.invariant} violation (would be ${event.priority})`,
      `Shadow mode violation — NOT enforced.\n\n${event.violation}\n\nContext: ${JSON.stringify(event.context, null, 2)}`,
    ).catch(() => {});
    return { blocked: false };
  }

  // Audit log
  await auditLog({
    action: `INVARIANT_${event.priority}`,
    resource: event.invariant,
    success: false,
    riskScore: config.riskScore,
    metadata: { violation: event.violation, modeBefore, modeAfter, ...event.context },
  });

  // Trigger reaction engine (async, non-blocking)
  try {
    const { react } = await import('@/lib/security/reactionEngine');
    react(event.context.userId as string | undefined, config.riskScore, {
      action: `invariant_${event.priority.toLowerCase()}`,
      resource: event.invariant,
      userEmail: event.context.userEmail as string | undefined,
    }).catch(() => {});
  } catch { /* non-critical */ }

  // Alerts
  if (config.sendSMS) {
    sendAlertSMS(`[TakeMe ${event.priority}] ${event.invariant}: ${event.violation.slice(0, 100)}`).catch(() => {});
  }
  sendAlertEmail(
    `[TakeMe ${event.priority}] Invariant violation: ${event.invariant}`,
    [
      `Priority: ${event.priority}`,
      `Invariant: ${event.invariant}`,
      `Violation: ${event.violation}`,
      `Mode: ${modeBefore} → ${modeAfter}`,
      `Auto-resolved: ${event.autoResolved}`,
      `Time: ${event.timestamp}`,
      '',
      `Context: ${JSON.stringify(event.context, null, 2)}`,
    ].join('\n'),
  ).catch(() => {});

  return { blocked: config.blockOperation };
}

/**
 * Emit a near-miss event (within 10% of threshold).
 */
export async function emitNearMiss(invariant: InvariantName, description: string, context: Record<string, unknown>): Promise<void> {
  await recordNearMissMetric(invariant);

  try {
    const svc = createServiceClient();
    await svc.from('monitoring_logs').insert({
      service: `invariant:${invariant}`,
      status: 'warn',
      latency_ms: 0,
      error: `Near-miss: ${description}`,
    });
  } catch { /* non-critical */ }
}

// ── Alert helpers ────────────────────────────────────────────────────────

async function sendAlertEmail(subject: string, body: string): Promise<void> {
  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const ses = new SESClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
    });
    await ses.send(new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL ?? 'acilholding@gmail.com',
      Destination: { ToAddresses: ['acilholding@gmail.com'] },
      Message: { Subject: { Data: subject }, Body: { Text: { Data: body } } },
    }));
  } catch { /* SES may be down */ }
}

async function sendAlertSMS(message: string): Promise<void> {
  const phone = process.env.ADMIN_PHONE_NUMBER;
  if (!phone) return;
  try {
    const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
    const sns = new SNSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
    });
    await sns.send(new PublishCommand({ PhoneNumber: phone, Message: message }));
  } catch { /* SNS may be down */ }
}
