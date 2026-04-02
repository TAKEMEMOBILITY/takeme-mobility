import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/lib/admin-audit';

const STRIPE_API = 'https://api.stripe.com/v1';

function getStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key || key.includes('PASTE_YOUR')) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return key;
}

// GET /api/admin/rentals — List all rentals with filters
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = request.nextUrl;
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  const svc = createServiceClient();

  try {
    let query = svc
      .from('rentals')
      .select(`
        id, user_id, vehicle_key, vehicle_name, category,
        daily_rate, total_days, subtotal, addons, addons_total,
        total_amount, currency, pickup_date, return_date,
        pickup_location, status, stripe_payment_intent, stripe_session_id,
        confirmation_code, notes, created_at, updated_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (from) {
      query = query.gte('created_at', new Date(from).toISOString());
    }
    if (to) {
      query = query.lte('created_at', new Date(to).toISOString());
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[admin/rentals] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch rentals' }, { status: 500 });
    }

    const rentals = data ?? [];

    // Fetch user emails from auth.users via service client
    const userIds = [...new Set(rentals.map((r: Record<string, unknown>) => r.user_id as string))];
    const userMap: Record<string, string> = {};

    if (userIds.length > 0) {
      // Batch fetch user data from the riders table (which has email)
      const { data: riders } = await svc
        .from('riders')
        .select('id, email, full_name')
        .in('id', userIds);

      if (riders) {
        for (const r of riders) {
          userMap[r.id] = r.email ?? r.full_name ?? 'Unknown';
        }
      }
    }

    // Enrich rentals with user info
    const enriched = rentals.map((r: Record<string, unknown>) => ({
      ...r,
      user_email: userMap[r.user_id as string] ?? 'Unknown',
    }));

    // Compute stats
    const allRentals = enriched;
    const totalRevenue = allRentals
      .filter((r: Record<string, unknown>) =>
        ['confirmed', 'active', 'completed'].includes(r.status as string)
      )
      .reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.total_amount ?? 0), 0);

    const stats = {
      total: count ?? 0,
      active: allRentals.filter((r: Record<string, unknown>) => r.status === 'active').length,
      pending: allRentals.filter((r: Record<string, unknown>) => r.status === 'pending').length,
      revenue: totalRevenue,
    };

    return NextResponse.json({ rentals: enriched, total: count ?? 0, limit, offset, stats });
  } catch (err) {
    console.error('[admin/rentals]', err);
    return NextResponse.json({ error: 'Failed to fetch rentals' }, { status: 500 });
  }
}

// POST /api/admin/rentals — Admin actions on rentals
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { action, rentalId, reason } = await request.json();

    if (!action || !rentalId) {
      return NextResponse.json({ error: 'Missing action or rentalId' }, { status: 400 });
    }

    const svc = createServiceClient();

    // Fetch the rental
    const { data: rental, error: fetchError } = await svc
      .from('rentals')
      .select('*')
      .eq('id', rentalId)
      .single();

    if (fetchError || !rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    switch (action) {
      case 'cancel_rental': {
        if (['cancelled', 'refunded', 'completed'].includes(rental.status)) {
          return NextResponse.json(
            { error: `Cannot cancel rental with status ${rental.status}` },
            { status: 409 },
          );
        }

        // If there's a payment intent, cancel it
        if (rental.stripe_payment_intent && ['pending', 'confirmed'].includes(rental.status)) {
          try {
            const stripeKey = getStripeKey();
            await fetch(`${STRIPE_API}/payment_intents/${rental.stripe_payment_intent}/cancel`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${stripeKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                'cancellation_reason': 'requested_by_customer',
              }).toString(),
            });
          } catch (stripeErr) {
            console.error('[admin/rentals] Stripe cancel error:', stripeErr);
          }
        }

        const { error: updateError } = await svc
          .from('rentals')
          .update({
            status: 'cancelled',
            notes: reason ? `${rental.notes ? rental.notes + '\n' : ''}Admin cancelled: ${reason}` : rental.notes,
            updated_at: now,
          })
          .eq('id', rentalId);

        if (updateError) throw updateError;

        await logAdminAction({
          adminId: auth.user.id,
          adminEmail: auth.user.email,
          action: 'cancel_rental',
          targetType: 'rental',
          targetId: rentalId,
          details: { reason, previousStatus: rental.status },
        });

        return NextResponse.json({ success: true, status: 'cancelled' });
      }

      case 'refund_rental': {
        if (!['confirmed', 'active', 'completed'].includes(rental.status)) {
          return NextResponse.json(
            { error: `Cannot refund rental with status ${rental.status}` },
            { status: 409 },
          );
        }

        if (!rental.stripe_payment_intent) {
          return NextResponse.json({ error: 'No payment intent to refund' }, { status: 400 });
        }

        // Create a refund via Stripe
        const stripeKey = getStripeKey();
        const refundRes = await fetch(`${STRIPE_API}/refunds`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'payment_intent': rental.stripe_payment_intent,
            'reason': 'requested_by_customer',
          }).toString(),
        });

        const refundData = await refundRes.json();
        if (!refundRes.ok) {
          const msg = refundData?.error?.message || `Stripe refund error ${refundRes.status}`;
          return NextResponse.json({ error: msg }, { status: 500 });
        }

        const { error: updateError } = await svc
          .from('rentals')
          .update({
            status: 'refunded',
            notes: `${rental.notes ? rental.notes + '\n' : ''}Refunded by admin. Refund ID: ${refundData.id}`,
            updated_at: now,
          })
          .eq('id', rentalId);

        if (updateError) throw updateError;

        await logAdminAction({
          adminId: auth.user.id,
          adminEmail: auth.user.email,
          action: 'refund_rental',
          targetType: 'rental',
          targetId: rentalId,
          details: { refundId: refundData.id, amount: rental.total_amount, reason },
        });

        return NextResponse.json({ success: true, status: 'refunded', refundId: refundData.id });
      }

      case 'mark_active': {
        if (rental.status !== 'confirmed') {
          return NextResponse.json(
            { error: `Can only mark confirmed rentals as active, current status: ${rental.status}` },
            { status: 409 },
          );
        }

        const { error: updateError } = await svc
          .from('rentals')
          .update({ status: 'active', updated_at: now })
          .eq('id', rentalId);

        if (updateError) throw updateError;

        await logAdminAction({
          adminId: auth.user.id,
          adminEmail: auth.user.email,
          action: 'mark_active',
          targetType: 'rental',
          targetId: rentalId,
          details: { previousStatus: rental.status },
        });

        return NextResponse.json({ success: true, status: 'active' });
      }

      case 'mark_completed': {
        if (rental.status !== 'active') {
          return NextResponse.json(
            { error: `Can only mark active rentals as completed, current status: ${rental.status}` },
            { status: 409 },
          );
        }

        const { error: updateError } = await svc
          .from('rentals')
          .update({ status: 'completed', updated_at: now })
          .eq('id', rentalId);

        if (updateError) throw updateError;

        await logAdminAction({
          adminId: auth.user.id,
          adminEmail: auth.user.email,
          action: 'mark_completed',
          targetType: 'rental',
          targetId: rentalId,
          details: { previousStatus: rental.status },
        });

        return NextResponse.json({ success: true, status: 'completed' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[admin/rentals] Action error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Action failed' },
      { status: 500 },
    );
  }
}
