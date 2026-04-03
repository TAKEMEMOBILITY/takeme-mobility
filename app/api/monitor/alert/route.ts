import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/monitor/alert
//
// Deduplicated alert dispatch — email via SES, SMS via SNS.
// Skips if same service alerted in last 5 minutes.
// ═══════════════════════════════════════════════════════════════════════════

const ALERT_EMAIL = 'acilholding@gmail.com';
const ALERT_PHONE = process.env.ADMIN_PHONE_NUMBER;
const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'noreply@takememobility.com';
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://takememobility.com';

function getAWSConfig() {
  return {
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { service, error, severity } = await request.json() as {
    service: string; error: string; severity: string;
  };

  const sb = createServiceClient();

  // Deduplication: check if same service alerted in last 5 minutes
  const { data: recent } = await sb
    .from('monitoring_alerts')
    .select('id')
    .eq('service', service)
    .gte('sent_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1);

  if (recent && recent.length > 0) {
    return NextResponse.json({ sent: false, deduplicated: true });
  }

  // Send email alert
  let emailSent = false;
  try {
    const ses = new SESClient(getAWSConfig());
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [ALERT_EMAIL] },
      Message: {
        Subject: { Data: `[TakeMe ${severity.toUpperCase()}] ${service}` },
        Body: {
          Text: {
            Data: [
              `Service: ${service}`,
              `Severity: ${severity}`,
              `Time: ${new Date().toISOString()}`,
              '',
              'Error:',
              error,
              '',
              `Dashboard: ${APP_URL}/admin/monitoring`,
              `Auto-fix: ${APP_URL}/api/monitor/autofix`,
            ].join('\n'),
          },
        },
      },
    }));
    emailSent = true;
  } catch (e) {
    console.error('[alert] Email failed:', (e as Error).message);
  }

  // Send SMS alert
  let smsSent = false;
  if (ALERT_PHONE && (severity === 'critical' || severity === 'high')) {
    try {
      const sns = new SNSClient(getAWSConfig());
      await sns.send(new PublishCommand({
        PhoneNumber: ALERT_PHONE,
        Message: `[TakeMe ${severity.toUpperCase()}] ${service} is down. Check ${APP_URL}/admin/monitoring`,
      }));
      smsSent = true;
    } catch (e) {
      console.error('[alert] SMS failed:', (e as Error).message);
    }
  }

  // Log alert
  await sb.from('monitoring_alerts').insert({
    service,
    error,
    severity,
  });

  return NextResponse.json({ sent: emailSent || smsSent, deduplicated: false, emailSent, smsSent });
}
