import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/lib/admin-audit';
import { createRefund, capturePaymentIntent } from '@/lib/stripe';

// GET /api/admin/payments — List payments with filters
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const svc = createServiceClient();

  let query = svc
    .from('payments')
    .select(`
      id, ride_id, rider_id, stripe_payment_intent, stripe_charge_id,
      payment_method_type, amount, currency, status,
      authorized_at, captured_at, failed_at, refunded_at, failure_reason,
      rides!inner(pickup_address, dropoff_address),
      riders!inner(full_name, email)
    `, { count: 'exact' })
    .order('authorized_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (from) {
    query = query.gte('authorized_at', from);
  }
  if (to) {
    query = query.lte('authorized_at', to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[admin/payments] Query error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }

  return NextResponse.json({
    payments: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}

// POST /api/admin/payments — Payment actions
const retryCaptureSchema = z.object({
  action: z.literal('retry_capture'),
  paymentId: z.string().uuid(),
  reason: z.string().optional(),
});

const refundSchema = z.object({
  action: z.literal('refund'),
  paymentId: z.string().uuid(),
  amount: z.number().positive().optional(), // partial refund; omit for full
  reason: z.string().min(1, 'Reason is required'),
});

const markResolvedSchema = z.object({
  action: z.literal('mark_resolved'),
  paymentId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required'),
});

const actionSchema = z.discriminatedUnion('action', [
  retryCaptureSchema,
  refundSchema,
  markResolvedSchema,
]);

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = actionSchema.parse(await request.json());
    const svc = createServiceClient();
    const now = new Date().toISOString();
    const { user } = auth;

    switch (body.action) {
      case 'retry_capture': {
        // Fetch the payment
        const { data: payment, error: payErr } = await svc
          .from('payments')
          .select('id, stripe_payment_intent, status, amount')
          .eq('id', body.paymentId)
          .single();

        if (payErr || !payment) {
          return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        if (payment.status !== 'authorized') {
          return NextResponse.json(
            { error: `Cannot capture a ${payment.status} payment. Only authorized payments can be captured.` },
            { status: 400 },
          );
        }

        try {
          const result = await capturePaymentIntent(payment.stripe_payment_intent);

          await svc
            .from('payments')
            .update({ status: 'captured', captured_at: now })
            .eq('id', body.paymentId);

          await logAdminAction({
            adminId: user.id,
            adminEmail: user.email,
            action: 'retry_capture',
            targetType: 'payment',
            targetId: body.paymentId,
            details: {
              stripe_payment_intent: payment.stripe_payment_intent,
              stripe_status: result.status,
              reason: body.reason,
            },
          });

          return NextResponse.json({ success: true, action: 'retry_capture', stripeStatus: result.status });
        } catch (err) {
          // Update payment as failed
          await svc
            .from('payments')
            .update({
              status: 'failed',
              failed_at: now,
              failure_reason: err instanceof Error ? err.message : 'Capture failed',
            })
            .eq('id', body.paymentId);

          return NextResponse.json(
            { error: `Capture failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
            { status: 500 },
          );
        }
      }

      case 'refund': {
        const { data: payment, error: payErr } = await svc
          .from('payments')
          .select('id, stripe_payment_intent, status, amount')
          .eq('id', body.paymentId)
          .single();

        if (payErr || !payment) {
          return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        if (payment.status !== 'captured') {
          return NextResponse.json(
            { error: `Cannot refund a ${payment.status} payment. Only captured payments can be refunded.` },
            { status: 400 },
          );
        }

        if (body.amount && body.amount > payment.amount) {
          return NextResponse.json(
            { error: `Refund amount ($${(body.amount / 100).toFixed(2)}) exceeds payment amount ($${(payment.amount / 100).toFixed(2)})` },
            { status: 400 },
          );
        }

        try {
          const stripeReason = body.reason.toLowerCase().includes('duplicate')
            ? 'duplicate'
            : body.reason.toLowerCase().includes('fraud')
              ? 'fraudulent'
              : 'requested_by_customer';

          const result = await createRefund(
            payment.stripe_payment_intent,
            body.amount,
            stripeReason,
          );

          await svc
            .from('payments')
            .update({ status: 'refunded', refunded_at: now })
            .eq('id', body.paymentId);

          await logAdminAction({
            adminId: user.id,
            adminEmail: user.email,
            action: 'refund',
            targetType: 'payment',
            targetId: body.paymentId,
            details: {
              stripe_payment_intent: payment.stripe_payment_intent,
              refund_id: result.id,
              amount: body.amount ?? payment.amount,
              partial: !!body.amount,
              reason: body.reason,
            },
          });

          return NextResponse.json({
            success: true,
            action: 'refund',
            refundId: result.id,
            amount: body.amount ?? payment.amount,
          });
        } catch (err) {
          return NextResponse.json(
            { error: `Refund failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
            { status: 500 },
          );
        }
      }

      case 'mark_resolved': {
        const { data: payment, error: payErr } = await svc
          .from('payments')
          .select('id, status')
          .eq('id', body.paymentId)
          .single();

        if (payErr || !payment) {
          return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        if (payment.status !== 'failed' && payment.status !== 'disputed') {
          return NextResponse.json(
            { error: `Cannot resolve a ${payment.status} payment. Only failed or disputed payments can be resolved.` },
            { status: 400 },
          );
        }

        await svc
          .from('payments')
          .update({ status: 'resolved' })
          .eq('id', body.paymentId);

        await logAdminAction({
          adminId: user.id,
          adminEmail: user.email,
          action: 'mark_resolved',
          targetType: 'payment',
          targetId: body.paymentId,
          details: { previousStatus: payment.status, reason: body.reason },
        });

        return NextResponse.json({ success: true, action: 'mark_resolved' });
      }
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.issues },
        { status: 400 },
      );
    }
    console.error('[admin/payments]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Action failed' },
      { status: 500 },
    );
  }
}
