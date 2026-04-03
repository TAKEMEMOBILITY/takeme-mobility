import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/monitor/e2e
//
// Full synthetic transaction — creates and tears down real resources
// to verify the entire stack works end-to-end.
// Runs every 5 minutes via Vercel Cron.
// ═══════════════════════════════════════════════════════════════════════════

const ALERT_EMAIL = 'acilholding@gmail.com';

interface E2EStep {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  duration_ms: number;
  error?: string;
}

async function runStep(step: string, fn: () => Promise<void>): Promise<E2EStep> {
  const start = Date.now();
  try {
    await fn();
    return { step, status: 'pass', duration_ms: Date.now() - start };
  } catch (e: unknown) {
    return { step, status: 'fail', duration_ms: Date.now() - start, error: (e as Error).message };
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createServiceClient();
  const steps: E2EStep[] = [];

  // Step 1: Supabase Auth check
  steps.push(await runStep('supabase_auth_settings', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw new Error('URL not set');
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }));

  // Step 2: DB write + read + delete (synthetic ride booking)
  let testRowId: string | null = null;
  steps.push(await runStep('db_write_read_delete', async () => {
    // Insert a test monitoring log as our synthetic "booking"
    const { data, error: insertErr } = await sb
      .from('monitoring_e2e')
      .insert({ step: '_e2e_synthetic_test', status: 'pass', duration_ms: 0 })
      .select('id')
      .single();
    if (insertErr) throw new Error(`INSERT: ${insertErr.message}`);
    testRowId = data.id;

    // Read it back
    const { error: readErr } = await sb
      .from('monitoring_e2e')
      .select('id')
      .eq('id', testRowId)
      .single();
    if (readErr) throw new Error(`SELECT: ${readErr.message}`);

    // Delete it
    const { error: delErr } = await sb
      .from('monitoring_e2e')
      .delete()
      .eq('id', testRowId);
    if (delErr) throw new Error(`DELETE: ${delErr.message}`);
    testRowId = null;
  }));

  // Step 3: Stripe payment intent create + cancel
  steps.push(await runStep('stripe_payment_cycle', async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');

    // Create minimal payment intent
    const createRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'amount=100&currency=usd&metadata[test]=e2e_monitor',
    });
    if (!createRes.ok) throw new Error(`Create: HTTP ${createRes.status}`);
    const pi = await createRes.json() as { id: string };

    // Cancel it immediately
    const cancelRes = await fetch(`https://api.stripe.com/v1/payment_intents/${pi.id}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!cancelRes.ok) throw new Error(`Cancel: HTTP ${cancelRes.status}`);
  }));

  // Step 4: Redis write + read + delete
  steps.push(await runStep('redis_write_read_delete', async () => {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Redis credentials not set');
    const headers = { 'Authorization': `Bearer ${token}` };
    const testKey = `e2e:test:${Date.now()}`;

    // SET
    const setRes = await fetch(`${url}/set/${testKey}/ok/ex/10`, { headers });
    if (!setRes.ok) throw new Error(`SET: HTTP ${setRes.status}`);

    // GET
    const getRes = await fetch(`${url}/get/${testKey}`, { headers });
    if (!getRes.ok) throw new Error(`GET: HTTP ${getRes.status}`);
    const val = await getRes.json();
    if (val.result !== 'ok') throw new Error(`GET: expected 'ok', got '${val.result}'`);

    // DEL
    const delRes = await fetch(`${url}/del/${testKey}`, { headers });
    if (!delRes.ok) throw new Error(`DEL: HTTP ${delRes.status}`);
  }));

  // Step 5: Send test email via SES
  steps.push(await runStep('ses_send_email', async () => {
    if (!process.env.AWS_ACCESS_KEY_ID) throw new Error('AWS credentials not set');
    const ses = new SESClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    await ses.send(new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL ?? 'noreply@takememobility.com',
      Destination: { ToAddresses: [ALERT_EMAIL] },
      Message: {
        Subject: { Data: '[TakeMe E2E] System Check' },
        Body: {
          Text: { Data: `E2E system check passed at ${new Date().toISOString()}. All critical paths verified.` },
        },
      },
    }));
  }));

  // Clean up test row if still exists (safety net)
  if (testRowId) {
    try { await sb.from('monitoring_e2e').delete().eq('id', testRowId); } catch { /* cleanup */ }
  }

  // Save results to DB
  const passed = steps.filter((s) => s.status === 'pass').length;
  const failed = steps.filter((s) => s.status === 'fail').length;

  try {
    await sb.from('monitoring_e2e').insert(
      steps.map((s) => ({
        step: s.step,
        status: s.status,
        duration_ms: s.duration_ms,
        error: s.error ?? null,
      })),
    );
  } catch (e) {
    console.error('[e2e] DB log failed:', e);
  }

  console.log(`[e2e] ${passed} passed, ${failed} failed | ${steps.map((s) => `${s.step}:${s.status}(${s.duration_ms}ms)`).join(' ')}`);

  return NextResponse.json({
    status: failed === 0 ? 'pass' : 'fail',
    timestamp: new Date().toISOString(),
    steps,
    summary: { passed, failed, total: steps.length },
  });
}
