import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/driver/approve
//
// Admin endpoint: approves a driver application and provisions the driver.
// Creates driver record, vehicle, wallet, and optionally triggers card.
//
// In production, protect this with an admin API key or admin role check.
// ═══════════════════════════════════════════════════════════════════════════

const schema = z.object({
  applicationId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin auth check here
    const body = schema.parse(await request.json());
    const svc = createServiceClient();

    // Get application
    const { data: app } = await svc
      .from('driver_applications')
      .select('id, status, user_id, full_name')
      .eq('id', body.applicationId)
      .single();

    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    if (app.status === 'approved') return NextResponse.json({ error: 'Already approved' }, { status: 409 });

    // Approve
    await svc.from('driver_applications').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    }).eq('id', body.applicationId);

    // Provision driver via RPC
    const { data: driverId, error: provisionErr } = await svc.rpc('provision_approved_driver', {
      p_application_id: body.applicationId,
    });

    if (provisionErr) {
      console.error('[driver/approve] Provision failed:', provisionErr);
      return NextResponse.json({ error: provisionErr.message }, { status: 500 });
    }

    // Trigger card creation (non-blocking)
    try {
      const { createCardholder, createVirtualCard } = await import('@/lib/stripe-issuing');
      const appData = await svc.from('driver_applications').select('*').eq('id', body.applicationId).single();

      if (appData.data) {
        const ch = await createCardholder({
          name: appData.data.full_name,
          email: appData.data.email || '',
          phone: appData.data.phone,
          userId: appData.data.user_id,
        });

        const card = await createVirtualCard(ch.id, appData.data.user_id);

        await svc.from('driver_cards').insert({
          driver_id: appData.data.user_id,
          stripe_cardholder_id: ch.id,
          stripe_virtual_card_id: card.id,
          card_status: 'virtual_ready',
        });
      }
    } catch (cardErr) {
      console.warn('[driver/approve] Card creation failed (non-fatal):', cardErr);
    }

    return NextResponse.json({
      approved: true,
      driverId,
      applicationId: body.applicationId,
    });
  } catch (err) {
    console.error('[driver/approve]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Approval failed' }, { status: 500 });
  }
}
