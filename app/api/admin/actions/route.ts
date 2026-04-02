import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/lib/admin-audit';

const schema = z.object({
  action: z.enum([
    'approve_driver', 'reject_driver', 'suspend_driver',
    'cancel_ride', 'refund_ride',
  ]),
  targetId: z.string(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = schema.parse(await request.json());
    const svc = createServiceClient();
    const now = new Date().toISOString();

    switch (body.action) {
      case 'approve_driver': {
        await svc.from('driver_applications').update({ status: 'approved', approved_at: now }).eq('id', body.targetId);
        try {
          const { data: provResult } = await svc.rpc('provision_approved_driver', { p_application_id: body.targetId });
          await logAdminAction({ adminId: auth.user.id, adminEmail: auth.user.email, action: 'approve_driver', targetType: 'driver', targetId: body.targetId, details: { driverId: provResult } });
          return NextResponse.json({ success: true, action: body.action, driverId: provResult });
        } catch {
          await logAdminAction({ adminId: auth.user.id, adminEmail: auth.user.email, action: 'approve_driver', targetType: 'driver', targetId: body.targetId, details: { warning: 'provisioning needs manual trigger' } });
          return NextResponse.json({ success: true, action: body.action, warning: 'Approved but provisioning needs manual trigger' });
        }
      }

      case 'reject_driver': {
        await svc.from('driver_applications').update({
          status: 'rejected',
          rejection_reason: body.reason ?? 'Does not meet requirements',
        }).eq('id', body.targetId);
        await logAdminAction({ adminId: auth.user.id, adminEmail: auth.user.email, action: 'reject_driver', targetType: 'driver', targetId: body.targetId, details: { reason: body.reason } });
        return NextResponse.json({ success: true, action: body.action });
      }

      case 'suspend_driver': {
        await svc.from('drivers').update({ is_active: false, status: 'offline' }).eq('id', body.targetId);
        await logAdminAction({ adminId: auth.user.id, adminEmail: auth.user.email, action: 'suspend_driver', targetType: 'driver', targetId: body.targetId, details: { reason: body.reason } });
        return NextResponse.json({ success: true, action: body.action });
      }

      case 'cancel_ride': {
        await svc.from('rides').update({
          status: 'cancelled', cancelled_at: now, cancelled_by: 'system',
          cancel_reason: body.reason ?? 'Cancelled by admin',
        }).eq('id', body.targetId).neq('status', 'completed');

        const { data: ride } = await svc.from('rides').select('assigned_driver_id').eq('id', body.targetId).single();
        if (ride?.assigned_driver_id) {
          await svc.from('drivers').update({ status: 'available' }).eq('id', ride.assigned_driver_id);
        }
        await logAdminAction({ adminId: auth.user.id, adminEmail: auth.user.email, action: 'cancel_ride', targetType: 'ride', targetId: body.targetId, details: { reason: body.reason, releasedDriver: ride?.assigned_driver_id } });
        return NextResponse.json({ success: true, action: body.action });
      }

      case 'refund_ride': {
        const { data: payment } = await svc.from('payments')
          .select('stripe_payment_intent, status, amount')
          .eq('ride_id', body.targetId)
          .single();

        if (payment?.stripe_payment_intent && payment.status === 'captured') {
          try {
            const { createRefund } = await import('@/lib/stripe');
            await createRefund(payment.stripe_payment_intent);
            await svc.from('payments').update({ status: 'refunded', refunded_at: now }).eq('ride_id', body.targetId);
            await logAdminAction({ adminId: auth.user.id, adminEmail: auth.user.email, action: 'refund_ride', targetType: 'payment', targetId: body.targetId, details: { amount: payment.amount, stripePI: payment.stripe_payment_intent } });
          } catch (err) {
            return NextResponse.json({ error: 'Refund failed: ' + (err instanceof Error ? err.message : '') }, { status: 500 });
          }
        }
        return NextResponse.json({ success: true, action: body.action });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[admin/actions]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Action failed' }, { status: 500 });
  }
}
