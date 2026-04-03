import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { SESClient, ListIdentitiesCommand } from '@aws-sdk/client-ses';
import { SNSClient, GetSMSAttributesCommand } from '@aws-sdk/client-sns';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/monitor
//
// Master health check — tests every critical service, logs to DB,
// triggers alerts on failure, includes RCA engine.
// Runs every minute via Vercel Cron.
// ═══════════════════════════════════════════════════════════════════════════

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://takememobility.com';

interface CheckResult {
  service: string;
  status: 'ok' | 'warn' | 'error';
  latency_ms: number;
  error?: string;
}

interface RCA {
  cause: string;
  confidence: number;
  autofix_available: boolean;
}

async function timed(service: string, fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { service, status: 'ok', latency_ms: Date.now() - start };
  } catch (e: unknown) {
    return { service, status: 'error', latency_ms: Date.now() - start, error: (e as Error).message };
  }
}

function getAWSCredentials() {
  return {
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  };
}

// ── Checks ───────────────────────────────────────────────────────────────

function checkPage(service: string, path: string) {
  return timed(service, async () => {
    const res = await fetch(`${APP_URL}${path}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
}

function checkHealthAPI() {
  return timed('api_health', async () => {
    const res = await fetch(`${APP_URL}/api/health`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.status !== 'ok') throw new Error(`status: ${body.status}`);
  });
}

function checkSupabaseDB() {
  return timed('supabase_db', async () => {
    const sb = createServiceClient();
    const { error } = await sb.from('profiles').select('id').limit(1);
    if (error) throw new Error(error.message);
  });
}

function checkSupabaseAuth() {
  return timed('supabase_auth', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw new Error('SUPABASE_URL not set');
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
}

function checkStripeAPI() {
  return timed('stripe_api', async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    const res = await fetch('https://api.stripe.com/v1/payment_intents?limit=1', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
}

function checkStripeWebhook() {
  return timed('stripe_webhook', async () => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET not set');
    const res = await fetch(`${APP_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.status === 404 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
  });
}

function checkSES() {
  return timed('aws_ses', async () => {
    if (!process.env.AWS_ACCESS_KEY_ID) throw new Error('AWS credentials not set');
    const ses = new SESClient(getAWSCredentials());
    await ses.send(new ListIdentitiesCommand({ MaxItems: 1 }));
  });
}

function checkSNS() {
  return timed('aws_sns', async () => {
    if (!process.env.AWS_ACCESS_KEY_ID) throw new Error('AWS credentials not set');
    const sns = new SNSClient(getAWSCredentials());
    await sns.send(new GetSMSAttributesCommand({ attributes: ['DefaultSMSType'] }));
  });
}

function checkRedis() {
  return timed('upstash_redis', async () => {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Redis credentials not set');
    const res = await fetch(`${url}/ping`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.result !== 'PONG') throw new Error(`Unexpected: ${JSON.stringify(body)}`);
  });
}

function checkAbly() {
  return timed('ably', async () => {
    const key = process.env.ABLY_KEY;
    if (!key) throw new Error('ABLY_KEY not set');
    const res = await fetch('https://rest.ably.io/time', {
      headers: { 'Authorization': `Basic ${Buffer.from(key).toString('base64')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
}

function checkQStash() {
  return timed('qstash', async () => {
    const token = process.env.US_EAST_1_QSTASH_TOKEN ?? process.env.QSTASH_TOKEN;
    if (!token) throw new Error('QStash token not set');
    const baseUrl = process.env.US_EAST_1_QSTASH_URL ?? 'https://qstash.upstash.io';
    const res = await fetch(`${baseUrl}/v2/messages`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
  });
}

// ── RCA Engine ───────────────────────────────────────────────────────────

function analyzeRCA(results: CheckResult[]): RCA | null {
  const failed = results.filter((r) => r.status === 'error');
  if (failed.length === 0) return null;

  const failedNames = new Set(failed.map((f) => f.service));

  // Single-service failures
  if (failed.length === 1) {
    const f = failed[0];
    if (f.service === 'aws_ses') {
      return { cause: 'IAM policy missing ses:SendEmail on takeme-sms user', confidence: 87, autofix_available: true };
    }
    if (f.service === 'aws_sns') {
      return { cause: 'AWS SNS permissions or sandbox restriction', confidence: 80, autofix_available: false };
    }
    if (f.service === 'stripe_api') {
      return { cause: 'Stripe API key invalid or rate limited', confidence: 78, autofix_available: false };
    }
    if (f.service === 'stripe_webhook') {
      return { cause: 'Stripe webhook endpoint unreachable or misconfigured', confidence: 75, autofix_available: false };
    }
    if (f.service === 'upstash_redis') {
      return { cause: 'Upstash Redis connection dropped or token expired', confidence: 85, autofix_available: true };
    }
    if (f.service === 'ably') {
      return { cause: 'Ably API key invalid or service degraded', confidence: 72, autofix_available: false };
    }
    if (f.service === 'qstash') {
      return { cause: 'QStash token expired or region misconfigured', confidence: 76, autofix_available: false };
    }
  }

  // Correlated failures
  if (failedNames.has('supabase_db') && failedNames.has('supabase_auth')) {
    return { cause: 'Supabase project connectivity issue — check project status', confidence: 92, autofix_available: false };
  }
  if (failedNames.has('supabase_db') && !failedNames.has('supabase_auth')) {
    return { cause: 'Supabase DB overloaded or service role key invalid', confidence: 84, autofix_available: false };
  }
  if (failedNames.has('aws_ses') && failedNames.has('aws_sns')) {
    return { cause: 'AWS IAM credentials expired or revoked for takeme-sms', confidence: 90, autofix_available: false };
  }
  if (failedNames.has('stripe_api') && failedNames.has('stripe_webhook')) {
    return { cause: 'Stripe integration broken — check API key rotation', confidence: 82, autofix_available: false };
  }

  // Page failures
  const pageFailures = failed.filter((f) => f.service.startsWith('page_'));
  if (pageFailures.length > 0 && failed.length === pageFailures.length) {
    return { cause: 'Vercel deployment issue — app not responding', confidence: 88, autofix_available: false };
  }

  // Multi-service outage
  if (failed.length >= 3) {
    return { cause: 'Infrastructure outage — check Vercel deployment and DNS', confidence: 70, autofix_available: false };
  }

  return { cause: `${failed.length} service(s) degraded — manual investigation needed`, confidence: 50, autofix_available: false };
}

// ── Blast radius ─────────────────────────────────────────────────────────

function getBlastRadius(service: string): string {
  const map: Record<string, string> = {
    supabase_db: 'All reads/writes, user profiles, ride history, bookings',
    supabase_auth: 'Login, signup, session refresh — all auth flows blocked',
    stripe_api: 'Payments, refunds, driver payouts — revenue impacted',
    stripe_webhook: 'Payment confirmations, subscription events — silent failures',
    aws_ses: 'Email OTP, verification emails, alerts — login via email broken',
    aws_sns: 'SMS OTP — login via phone broken',
    upstash_redis: 'Dispatch queue, driver matching, rate limiting — rides broken',
    ably: 'Live driver tracking — riders see stale map',
    qstash: 'Async dispatch scheduling — delayed ride matching',
    page_home: 'Homepage down — new users cannot access site',
    page_login: 'Login page down — existing users locked out',
    page_students: 'Student page down — student signups blocked',
    api_health: 'Health endpoint down — external monitors may fire false alarms',
  };
  return map[service] ?? 'Unknown impact';
}

// ── Main handler ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const timestamp = new Date().toISOString();

  const results = await Promise.all([
    checkPage('page_home', '/'),
    checkPage('page_login', '/auth/login'),
    checkPage('page_students', '/students'),
    checkHealthAPI(),
    checkSupabaseDB(),
    checkSupabaseAuth(),
    checkStripeAPI(),
    checkStripeWebhook(),
    checkSES(),
    checkSNS(),
    checkRedis(),
    checkAbly(),
    checkQStash(),
  ]);

  const failures = results.filter((r) => r.status === 'error');
  const rca = analyzeRCA(results);

  // Determine customer impact level
  const criticalServices = new Set(['supabase_db', 'supabase_auth', 'stripe_api', 'upstash_redis']);
  const hasCritical = failures.some((f) => criticalServices.has(f.service));
  const impact = failures.length === 0 ? 'none' : hasCritical ? 'critical' : 'degraded';

  // Log to DB (non-blocking)
  const logPromise = (async () => {
    try {
      const sb = createServiceClient();
      await sb.from('monitoring_logs').insert(
        results.map((r) => ({
          service: r.service,
          status: r.status,
          latency_ms: r.latency_ms,
          error: r.error ?? null,
        })),
      );
    } catch (e) {
      console.error('[monitor] DB log failed:', (e as Error).message);
    }
  })();

  // Trigger alert if failures (non-blocking)
  const alertPromise = failures.length > 0
    ? fetch(`${APP_URL}/api/monitor/alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          service: failures.map((f) => f.service).join(', '),
          error: failures.map((f) => `${f.service}: ${f.error}`).join('\n'),
          severity: hasCritical ? 'critical' : 'high',
        }),
      }).catch((e) => console.error('[monitor] Alert failed:', e))
    : Promise.resolve();

  await Promise.all([logPromise, alertPromise]);

  console.log(`[monitor] ${timestamp} | ${impact.toUpperCase()} | ${failures.length} failures | ${results.map((r) => `${r.service}:${r.status}(${r.latency_ms}ms)`).join(' ')}`);

  return NextResponse.json({
    status: impact,
    timestamp,
    checks: results.map((r) => ({ ...r, blast_radius: r.status === 'error' ? getBlastRadius(r.service) : undefined })),
    failures: failures.length,
    rca,
  });
}
