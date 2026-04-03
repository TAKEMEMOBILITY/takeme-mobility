import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/permissions';
import { auditLog } from '@/lib/auth/audit';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/monitor/simulate — Run failure simulation scenarios
// Returns fake failure data. Does NOT write to real monitoring_logs.
// Writes to simulation_logs instead.
// ═══════════════════════════════════════════════════════════════════════════

interface SimCheck {
  service: string; status: 'ok' | 'warn' | 'error';
  latency_ms: number; error?: string; blast_radius?: string;
}

const BLAST: Record<string, string> = {
  supabase_db: 'All reads/writes, profiles, ride history, bookings',
  supabase_auth: 'Login, signup, session refresh — all auth flows blocked',
  stripe_api: 'Payments, refunds, driver payouts — revenue impacted',
  aws_ses: 'Email OTP, verification — login via email broken',
  aws_sns: 'SMS OTP — login via phone broken',
  upstash_redis: 'Dispatch queue, driver matching, rate limiting — rides broken',
  ably: 'Live driver tracking — riders see stale map',
  qstash: 'Async dispatch scheduling — delayed ride matching',
};

const SERVICES = ['page_home', 'page_login', 'page_students', 'api_health', 'supabase_db', 'supabase_auth', 'stripe_api', 'stripe_webhook', 'aws_ses', 'aws_sns', 'upstash_redis', 'ably', 'qstash'];

function baseOK(): SimCheck[] {
  return SERVICES.map(s => ({ service: s, status: 'ok' as const, latency_ms: 20 + Math.floor(Math.random() * 80) }));
}

function applyFailure(checks: SimCheck[], service: string, error: string, latency = 0): void {
  const c = checks.find(c => c.service === service);
  if (c) { c.status = 'error'; c.error = error; c.latency_ms = latency; c.blast_radius = BLAST[service]; }
}

const SCENARIOS: Record<string, { description: string; apply: (checks: SimCheck[]) => void; autoMode?: string; reactions: string[] }> = {
  ses_down: {
    description: 'AWS SES service failure — email OTP broken',
    apply: (c) => applyFailure(c, 'aws_ses', 'AccessDenied: ses:SendEmail not authorized', 150),
    reactions: ['AUTO_ALERT'],
  },
  db_latency: {
    description: 'Supabase DB high latency — degraded performance',
    apply: (c) => { const s = c.find(x => x.service === 'supabase_db'); if (s) { s.status = 'warn'; s.latency_ms = 2400; } },
    reactions: [],
  },
  auth_failure: {
    description: 'Supabase Auth down — all login flows blocked',
    apply: (c) => {
      applyFailure(c, 'supabase_auth', 'Connection refused: auth service unreachable', 5000);
      applyFailure(c, 'supabase_db', 'Connection pool exhausted', 3200);
    },
    autoMode: 'DEFENSIVE',
    reactions: ['AUTO_MODE_CHANGE → DEFENSIVE', 'AUTO_ALERT'],
  },
  redis_down: {
    description: 'Upstash Redis down — dispatch queue broken',
    apply: (c) => applyFailure(c, 'upstash_redis', 'ECONNREFUSED: Redis connection failed', 5000),
    reactions: ['AUTO_ALERT', 'AUTO_FIX_ATTEMPT'],
  },
  full_outage: {
    description: 'Total infrastructure failure — all services down',
    apply: (c) => {
      ['supabase_db', 'supabase_auth', 'stripe_api', 'aws_ses', 'upstash_redis', 'ably', 'qstash'].forEach(s =>
        applyFailure(c, s, 'Service unreachable: connection timed out', 5000)
      );
      ['page_home', 'page_login'].forEach(s => applyFailure(c, s, 'HTTP 503', 5000));
    },
    autoMode: 'LOCKDOWN',
    reactions: ['AUTO_MODE_CHANGE → LOCKDOWN', 'AUTO_FORCE_LOGOUT (all non-admin)', 'AUTO_ACCOUNT_LOCK (suspicious)'],
  },
  ddos: {
    description: 'DDoS simulation — risk score flooding',
    apply: (c) => {
      const s = c.find(x => x.service === 'api_health'); if (s) { s.status = 'warn'; s.latency_ms = 1800; }
      applyFailure(c, 'upstash_redis', 'Rate limit exceeded: too many requests', 200);
    },
    autoMode: 'DEFENSIVE',
    reactions: ['AUTO_PATTERN_LOCK (multiple users)', 'AUTO_MODE_CHANGE → DEFENSIVE', 'AUTO_ALERT (critical)'],
  },
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const { allowed } = await requireRole(user.id, ['ops_core', 'exec_founder', 'super_admin'], request);
  if (!allowed) return new NextResponse(null, { status: 404 });

  const { scenario } = await request.json() as { scenario: string };
  const config = SCENARIOS[scenario];
  if (!config) return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 });

  const checks = baseOK();
  config.apply(checks);

  const failures = checks.filter(c => c.status === 'error');
  const criticalSet = new Set(['supabase_db', 'supabase_auth', 'stripe_api', 'upstash_redis']);
  const hasCritical = failures.some(f => criticalSet.has(f.service));
  const impact = failures.length === 0 ? 'none' : hasCritical ? 'critical' : 'degraded';

  // Write to simulation_logs (not real monitoring_logs)
  const svc = createServiceClient();
  try {
    await svc.from('simulation_logs').insert(
      checks.map(c => ({ scenario, service: c.service, status: c.status, latency_ms: c.latency_ms, error: c.error ?? null })),
    );
  } catch { /* non-critical */ }

  // Log simulation start
  await auditLog({
    userId: user.id, userEmail: user.email,
    action: 'SIMULATION_START', resource: 'simulation',
    success: true, request, riskScore: 0,
    metadata: { scenario },
  });

  return NextResponse.json({
    scenario,
    description: config.description,
    status: impact,
    timestamp: new Date().toISOString(),
    checks,
    failures: failures.length,
    projectedMode: config.autoMode ?? 'NORMAL',
    projectedReactions: config.reactions,
    rca: failures.length > 0 ? generateSimRCA(failures) : null,
    expiresIn: 60,
  });
}

function generateSimRCA(failures: SimCheck[]) {
  const names = failures.map(f => f.service);
  if (names.includes('supabase_db') && names.includes('supabase_auth')) {
    return [
      { cause: 'Supabase project connectivity failure', confidence: 72, autofixAvailable: false, manualSteps: 'Check Supabase dashboard status' },
      { cause: 'DNS resolution failure for supabase.co', confidence: 18, autofixAvailable: false, manualSteps: 'Verify DNS settings' },
      { cause: 'Vercel edge function region misconfiguration', confidence: 10, autofixAvailable: false, manualSteps: 'Check Vercel region settings' },
    ];
  }
  if (names.includes('aws_ses')) {
    return [
      { cause: 'IAM policy missing ses:SendEmail', confidence: 60, autofixAvailable: true, manualSteps: 'aws iam put-user-policy' },
      { cause: 'SES sandbox restriction', confidence: 25, autofixAvailable: false, manualSteps: 'Request production access in SES console' },
      { cause: 'Email identity unverified', confidence: 10, autofixAvailable: false, manualSteps: 'aws ses verify-email-identity' },
      { cause: 'Network egress blocking SES', confidence: 5, autofixAvailable: false, manualSteps: 'Check VPC/security group rules' },
    ];
  }
  return [
    { cause: `${failures[0].service} service failure`, confidence: 70, autofixAvailable: false, manualSteps: 'Investigate service logs' },
    { cause: 'Transient network issue', confidence: 20, autofixAvailable: false, manualSteps: 'Retry in 60 seconds' },
    { cause: 'Configuration drift', confidence: 10, autofixAvailable: false, manualSteps: 'Run policy check' },
  ];
}
