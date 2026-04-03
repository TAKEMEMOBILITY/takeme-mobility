import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { SESClient, SendEmailCommand, ListIdentitiesCommand } from '@aws-sdk/client-ses';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/monitor
//
// Production monitoring — deep health checks against all critical services.
// Runs every minute via Vercel Cron. Sends email alert on any failure.
// Auth: Vercel cron header or CRON_SECRET bearer token.
// ═══════════════════════════════════════════════════════════════════════════

const ALERT_EMAIL = 'acilholding@gmail.com';
const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'noreply@takememobility.com';
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://takememobility.com';

interface CheckResult {
  name: string;
  status: 'ok' | 'fail';
  latencyMs: number;
  error?: string;
}

async function timed(name: string, fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, status: 'ok', latencyMs: Date.now() - start };
  } catch (e: unknown) {
    return { name, status: 'fail', latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

// ── Page route checks ────────────────────────────────────────────────────

function checkPage(name: string, path: string) {
  return timed(name, async () => {
    const res = await fetch(`${APP_URL}${path}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
}

// ── Service checks ───────────────────────────────────────────────────────

function checkHealthEndpoint() {
  return timed('api_health', async () => {
    const res = await fetch(`${APP_URL}/api/health`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.status !== 'ok') throw new Error(`status: ${body.status}`);
  });
}

function checkSupabaseDB() {
  return timed('supabase_db', async () => {
    const supabase = createServiceClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
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

function checkStripe() {
  return timed('stripe_api', async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
}

function checkStripeWebhook() {
  return timed('stripe_webhook', async () => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET not set');
    // Verify the webhook endpoint is reachable (POST without signature → 400 expected, not 404/500)
    const res = await fetch(`${APP_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    // 400 = endpoint exists and rejected bad signature (expected)
    // 404 or 500 = broken
    if (res.status === 404 || res.status >= 500) {
      throw new Error(`HTTP ${res.status}`);
    }
  });
}

function getSESClient() {
  return new SESClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function checkSES() {
  return timed('aws_ses', async () => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials not set');
    }
    await getSESClient().send(new ListIdentitiesCommand({ MaxItems: 1 }));
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
  return timed('ably_realtime', async () => {
    const key = process.env.ABLY_KEY;
    if (!key) throw new Error('ABLY_KEY not set');
    // Ably REST API status check
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

// ── Alert email ──────────────────────────────────────────────────────────

async function sendAlert(failures: CheckResult[], allResults: CheckResult[]) {
  try {
    const failList = failures
      .map((f) => `  FAIL  ${f.name}: ${f.error} (${f.latencyMs}ms)`)
      .join('\n');

    const okList = allResults
      .filter((r) => r.status === 'ok')
      .map((r) => `  OK    ${r.name} (${r.latencyMs}ms)`)
      .join('\n');

    await getSESClient().send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [ALERT_EMAIL] },
        Message: {
          Subject: { Data: `[TakeMe] ALERT: ${failures.length} service(s) down` },
          Body: {
            Text: {
              Data: [
                `Production monitoring detected failures at ${new Date().toISOString()}`,
                '',
                'FAILED:',
                failList,
                '',
                'HEALTHY:',
                okList,
                '',
                `Dashboard: ${APP_URL}/admin`,
                `Monitor:   ${APP_URL}/api/monitor`,
              ].join('\n'),
            },
          },
        },
      }),
    );
  } catch (e) {
    console.error('[monitor] Failed to send alert email:', (e as Error).message);
  }
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

  // Run all checks in parallel
  const results = await Promise.all([
    // Page routes
    checkHealthEndpoint(),
    checkPage('page_home', '/'),
    checkPage('page_login', '/auth/login'),
    checkPage('page_students', '/students'),
    // Infrastructure
    checkSupabaseDB(),
    checkSupabaseAuth(),
    checkStripe(),
    checkStripeWebhook(),
    checkSES(),
    checkRedis(),
    checkAbly(),
    checkQStash(),
  ]);

  const failures = results.filter((r) => r.status === 'fail');
  const allOk = failures.length === 0;

  console.log(
    `[monitor] ${timestamp} | ${allOk ? 'ALL OK' : `${failures.length} FAILED`} | ${results.map((r) => `${r.name}:${r.status}(${r.latencyMs}ms)`).join(' ')}`,
  );

  if (!allOk) {
    await sendAlert(failures, results);
  }

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp,
    checks: results,
    failures: failures.length,
  });
}
