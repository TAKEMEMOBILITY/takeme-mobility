import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getDLQItems, getDLQLength } from '@/lib/redis';

// GET /api/admin/alerts — DLQ items, high/critical fraud events, failed payments
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const svc = createServiceClient();

  try {
    const [dlqItems, dlqLength, fraudResult, failedPaymentsResult] = await Promise.all([
      getDLQItems(50).catch(() => []),
      getDLQLength().catch(() => 0),
      // Recent fraud events with high/critical severity
      svc
        .from('fraud_events')
        .select(`
          id, user_id, ride_id, driver_id, event_type,
          severity, fraud_score, action_taken, details,
          device_fingerprint, ip_address, created_at
        `)
        .in('severity', ['high', 'critical'])
        .order('created_at', { ascending: false })
        .limit(50),
      // Recent failed payments
      svc
        .from('payments')
        .select(`
          id, ride_id, rider_id, stripe_payment_intent,
          amount, currency, status, payment_method_type, created_at
        `)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const fraudEvents = fraudResult.data ?? [];
    const failedPayments = failedPaymentsResult.data ?? [];

    return NextResponse.json({
      dlq: {
        items: dlqItems,
        total: dlqLength,
      },
      fraud: {
        events: fraudEvents,
        total: fraudEvents.length,
      },
      failed_payments: {
        items: failedPayments,
        total: failedPayments.length,
      },
      total_alerts: dlqLength + fraudEvents.length + failedPayments.length,
    });
  } catch (err) {
    console.error('[admin/alerts]', err);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}
