import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';

// GET — admin fleet dashboard data
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const svc = createServiceClient();
  const [owners, vehicles, bookings, payouts, disputes, pendingOwners, pendingVehicles] = await Promise.all([
    svc.from('fleet_owners').select('*', { count: 'exact', head: true }),
    svc.from('fleet_vehicles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    svc.from('rental_bookings').select('*', { count: 'exact', head: true }).not('status', 'in', '("cancelled","failed")'),
    svc.from('fleet_payouts').select('*', { count: 'exact', head: true }).eq('status', 'held'),
    svc.from('rental_bookings').select('*', { count: 'exact', head: true }).eq('status', 'disputed'),
    svc.from('fleet_owners').select('id, email, status, created_at').in('status', ['pending_documents','pending_kyc','pending_contract','pending_vehicle_review']).order('created_at', { ascending: false }).limit(20),
    svc.from('fleet_vehicles').select('id, make, model, year, status, owner_id, created_at').eq('status', 'pending_review').order('created_at', { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    metrics: {
      totalOwners: owners.count ?? 0,
      activeVehicles: vehicles.count ?? 0,
      activeBookings: bookings.count ?? 0,
      heldPayouts: payouts.count ?? 0,
      activeDisputes: disputes.count ?? 0,
    },
    pendingOwners: pendingOwners.data ?? [],
    pendingVehicles: pendingVehicles.data ?? [],
  });
}

// POST — admin actions (approve/reject owner/vehicle, hold payout)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { action, targetId, reason } = await request.json() as { action: string; targetId: string; reason?: string };
  const svc = createServiceClient();

  if (action === 'approve_owner') {
    await svc.from('fleet_owners').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: auth.user.id }).eq('id', targetId);
  } else if (action === 'reject_owner') {
    await svc.from('fleet_owners').update({ status: 'rejected', rejected_reason: reason }).eq('id', targetId);
  } else if (action === 'approve_vehicle') {
    await svc.from('fleet_vehicles').update({ status: 'active', approved_at: new Date().toISOString(), approved_by: auth.user.id }).eq('id', targetId);
  } else if (action === 'reject_vehicle') {
    await svc.from('fleet_vehicles').update({ status: 'rejected', rejected_reason: reason }).eq('id', targetId);
  } else if (action === 'suspend_owner') {
    await svc.from('fleet_owners').update({ status: 'suspended', suspended_reason: reason }).eq('id', targetId);
    // Suspend all owner vehicles
    await svc.from('fleet_vehicles').update({ status: 'suspended' }).eq('owner_id', targetId).eq('status', 'active');
  } else if (action === 'suspend_vehicle') {
    await svc.from('fleet_vehicles').update({ status: 'suspended' }).eq('id', targetId);
  } else if (action === 'hold_payout') {
    await svc.from('fleet_payouts').update({ status: 'held', held_reason: reason, held_by: auth.user.id }).eq('id', targetId);
  } else if (action === 'release_payout') {
    await svc.from('fleet_payouts').update({ status: 'pending', held_reason: null, held_by: null }).eq('id', targetId);
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  await auditLog({
    userId: auth.user.id, userEmail: auth.user.email,
    action: `fleet_admin_${action}`, resource: 'fleet',
    resourceId: targetId, success: true, riskScore: 10,
    metadata: { reason },
  });

  return NextResponse.json({ ok: true });
}
