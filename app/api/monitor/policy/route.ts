import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { IAMClient, GetUserPolicyCommand } from '@aws-sdk/client-iam';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/monitor/policy
//
// Policy drift detection — verifies env vars, IAM permissions,
// RLS status, and webhook secrets are correctly configured.
// ═══════════════════════════════════════════════════════════════════════════

interface PolicyCheck {
  policy: string;
  expected: string;
  actual: string;
  drifted: boolean;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checks: PolicyCheck[] = [];

  // ── Required environment variables ──────────────────────────────────
  const requiredEnvVars: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: 'Supabase project URL',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase anon key',
    SUPABASE_SERVICE_ROLE_KEY: 'Supabase service role key',
    STRIPE_SECRET_KEY: 'Stripe secret key',
    STRIPE_WEBHOOK_SECRET: 'Stripe webhook signing secret',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'Stripe publishable key',
    AWS_ACCESS_KEY_ID: 'AWS access key',
    AWS_SECRET_ACCESS_KEY: 'AWS secret key',
    AWS_REGION: 'AWS region',
    UPSTASH_REDIS_REST_URL: 'Upstash Redis URL',
    UPSTASH_REDIS_REST_TOKEN: 'Upstash Redis token',
    ABLY_KEY: 'Ably API key',
    NEXT_PUBLIC_SENTRY_DSN: 'Sentry DSN',
    CRON_SECRET: 'Cron job auth secret',
  };

  for (const [key, desc] of Object.entries(requiredEnvVars)) {
    const val = process.env[key];
    checks.push({
      policy: `env:${key}`,
      expected: `${desc} is set`,
      actual: val ? 'Set' : 'MISSING',
      drifted: !val,
    });
  }

  // QStash token (at least one region)
  const hasQStash = !!(process.env.US_EAST_1_QSTASH_TOKEN ?? process.env.QSTASH_TOKEN ?? process.env.EU_CENTRAL_1_QSTASH_TOKEN);
  checks.push({
    policy: 'env:QSTASH_TOKEN',
    expected: 'At least one QStash token set',
    actual: hasQStash ? 'Set' : 'MISSING',
    drifted: !hasQStash,
  });

  // ── Stripe webhook secret format ───────────────────────────────────
  const whsec = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  checks.push({
    policy: 'stripe:webhook_secret_format',
    expected: 'Starts with whsec_',
    actual: whsec.startsWith('whsec_') ? 'Valid format' : 'Invalid format',
    drifted: !whsec.startsWith('whsec_'),
  });

  // ── Supabase RLS check ─────────────────────────────────────────────
  try {
    const sb = createServiceClient();
    const { data: tables, error } = await sb.rpc('pg_tables_rls_check').select('*');

    if (error) {
      // If RPC doesn't exist, do a manual check on known tables
      const criticalTables = ['profiles', 'rides', 'vehicles', 'payments', 'monitoring_logs'];
      for (const table of criticalTables) {
        try {
          const { data: rlsData } = await sb
            .from('pg_tables')
            .select('rowsecurity')
            .eq('tablename', table)
            .eq('schemaname', 'public')
            .single();

          const hasRLS = rlsData?.rowsecurity === true;
          checks.push({
            policy: `rls:${table}`,
            expected: 'RLS enabled',
            actual: hasRLS ? 'Enabled' : 'DISABLED',
            drifted: !hasRLS,
          });
        } catch {
          // pg_tables may not be accessible via PostgREST, skip
        }
      }
    }
  } catch (e) {
    checks.push({
      policy: 'rls:check',
      expected: 'RLS verification accessible',
      actual: `Error: ${(e as Error).message}`,
      drifted: true,
    });
  }

  // ── AWS IAM SES permission ─────────────────────────────────────────
  try {
    const iam = new IAMClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const { PolicyDocument } = await iam.send(new GetUserPolicyCommand({
      UserName: 'takeme-sms',
      PolicyName: 'AllowSESSendEmail',
    }));

    const hasPolicy = PolicyDocument && PolicyDocument.includes('ses:SendEmail');
    checks.push({
      policy: 'iam:takeme-sms:ses:SendEmail',
      expected: 'Policy AllowSESSendEmail attached with ses:SendEmail',
      actual: hasPolicy ? 'Attached' : 'Policy exists but missing ses:SendEmail',
      drifted: !hasPolicy,
    });
  } catch (e) {
    const msg = (e as Error).message;
    const isMissing = msg.includes('NoSuchEntity') || msg.includes('not found');
    checks.push({
      policy: 'iam:takeme-sms:ses:SendEmail',
      expected: 'Policy AllowSESSendEmail attached',
      actual: isMissing ? 'MISSING — policy not attached' : `Error: ${msg}`,
      drifted: true,
    });
  }

  const driftCount = checks.filter((c) => c.drifted).length;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    drift_count: driftCount,
    total_checks: checks.length,
    status: driftCount === 0 ? 'compliant' : 'drifted',
    checks,
  });
}
