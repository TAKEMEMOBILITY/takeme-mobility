import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/lib/admin-audit';

const forceAssignSchema = z.object({
  action: z.literal('force_assign'),
  rideId: z.string().uuid(),
  driverId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required'),
});

const forceCompleteSchema = z.object({
  action: z.literal('force_complete'),
  rideId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required'),
});

const forceCancelSchema = z.object({
  action: z.literal('force_cancel'),
  rideId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required'),
});

const adjustFareSchema = z.object({
  action: z.literal('adjust_fare'),
  rideId: z.string().uuid(),
  newFare: z.number().positive(),
  reason: z.string().min(1, 'Reason is required'),
});

const bodySchema = z.discriminatedUnion('action', [
  forceAssignSchema,
  forceCompleteSchema,
  forceCancelSchema,
  adjustFareSchema,
]);

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = bodySchema.parse(await request.json());
    const svc = createServiceClient();
    const now = new Date().toISOString();
    const { user } = auth;

    switch (body.action) {
      case 'force_assign': {
        // Verify ride exists and is in a dispatchable state
        const { data: ride, error: rideErr } = await svc
          .from('rides')
          .select('id, status')
          .eq('id', body.rideId)
          .single();

        if (rideErr || !ride) {
          return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
        }

        // Verify driver exists and is available
        const { data: driver, error: driverErr } = await svc
          .from('drivers')
          .select('id, status, full_name')
          .eq('id', body.driverId)
          .single();

        if (driverErr || !driver) {
          return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
        }

        // Update ride assignment
        await svc
          .from('rides')
          .update({
            assigned_driver_id: body.driverId,
            status: 'driver_assigned',
          })
          .eq('id', body.rideId);

        // Set driver to busy
        await svc
          .from('drivers')
          .update({ status: 'busy' })
          .eq('id', body.driverId);

        // Log ride event
        await svc.from('ride_events').insert({
          ride_id: body.rideId,
          event_type: 'admin_force_assign',
          old_status: ride.status,
          new_status: 'driver_assigned',
          actor: 'admin',
          metadata: {
            admin_id: user.id,
            admin_email: user.email,
            driver_id: body.driverId,
            driver_name: driver.full_name,
            reason: body.reason,
          },
        });

        await logAdminAction({
          adminId: user.id,
          adminEmail: user.email,
          action: 'force_assign',
          targetType: 'ride',
          targetId: body.rideId,
          details: { driverId: body.driverId, reason: body.reason },
        });

        return NextResponse.json({ success: true, action: 'force_assign' });
      }

      case 'force_complete': {
        const { data: ride, error: rideErr } = await svc
          .from('rides')
          .select('id, status, assigned_driver_id')
          .eq('id', body.rideId)
          .single();

        if (rideErr || !ride) {
          return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
        }

        if (ride.status === 'completed') {
          return NextResponse.json({ error: 'Ride is already completed' }, { status: 400 });
        }

        // Complete the ride
        await svc
          .from('rides')
          .update({
            status: 'completed',
            trip_completed_at: now,
          })
          .eq('id', body.rideId);

        // Release driver if assigned
        if (ride.assigned_driver_id) {
          await svc
            .from('drivers')
            .update({ status: 'available' })
            .eq('id', ride.assigned_driver_id);
        }

        // Log ride event
        await svc.from('ride_events').insert({
          ride_id: body.rideId,
          event_type: 'admin_force_complete',
          old_status: ride.status,
          new_status: 'completed',
          actor: 'admin',
          metadata: {
            admin_id: user.id,
            admin_email: user.email,
            reason: body.reason,
          },
        });

        await logAdminAction({
          adminId: user.id,
          adminEmail: user.email,
          action: 'force_complete',
          targetType: 'ride',
          targetId: body.rideId,
          details: { previousStatus: ride.status, reason: body.reason },
        });

        return NextResponse.json({ success: true, action: 'force_complete' });
      }

      case 'force_cancel': {
        const { data: ride, error: rideErr } = await svc
          .from('rides')
          .select('id, status, assigned_driver_id')
          .eq('id', body.rideId)
          .single();

        if (rideErr || !ride) {
          return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
        }

        if (ride.status === 'completed' || ride.status === 'cancelled') {
          return NextResponse.json({ error: `Cannot cancel a ${ride.status} ride` }, { status: 400 });
        }

        // Cancel the ride
        await svc
          .from('rides')
          .update({
            status: 'cancelled',
            cancel_reason: body.reason,
            cancelled_by: 'admin',
          })
          .eq('id', body.rideId);

        // Release driver if assigned
        if (ride.assigned_driver_id) {
          await svc
            .from('drivers')
            .update({ status: 'available' })
            .eq('id', ride.assigned_driver_id);
        }

        // Log ride event
        await svc.from('ride_events').insert({
          ride_id: body.rideId,
          event_type: 'admin_force_cancel',
          old_status: ride.status,
          new_status: 'cancelled',
          actor: 'admin',
          metadata: {
            admin_id: user.id,
            admin_email: user.email,
            reason: body.reason,
          },
        });

        await logAdminAction({
          adminId: user.id,
          adminEmail: user.email,
          action: 'force_cancel',
          targetType: 'ride',
          targetId: body.rideId,
          details: { previousStatus: ride.status, reason: body.reason },
        });

        return NextResponse.json({ success: true, action: 'force_cancel' });
      }

      case 'adjust_fare': {
        const { data: ride, error: rideErr } = await svc
          .from('rides')
          .select('id, final_fare, estimated_fare')
          .eq('id', body.rideId)
          .single();

        if (rideErr || !ride) {
          return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
        }

        const previousFare = ride.final_fare ?? ride.estimated_fare;

        await svc
          .from('rides')
          .update({ final_fare: body.newFare })
          .eq('id', body.rideId);

        // Log ride event
        await svc.from('ride_events').insert({
          ride_id: body.rideId,
          event_type: 'admin_adjust_fare',
          actor: 'admin',
          metadata: {
            admin_id: user.id,
            admin_email: user.email,
            previous_fare: previousFare,
            new_fare: body.newFare,
            reason: body.reason,
          },
        });

        await logAdminAction({
          adminId: user.id,
          adminEmail: user.email,
          action: 'adjust_fare',
          targetType: 'ride',
          targetId: body.rideId,
          details: {
            previousFare,
            newFare: body.newFare,
            reason: body.reason,
          },
        });

        return NextResponse.json({ success: true, action: 'adjust_fare', previousFare, newFare: body.newFare });
      }
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.issues },
        { status: 400 },
      );
    }
    console.error('[admin/override]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Override failed' },
      { status: 500 },
    );
  }
}
