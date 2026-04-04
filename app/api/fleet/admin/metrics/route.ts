import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'

// GET — Dashboard metrics (admin only)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const svc = createServiceClient()

    const [
      activeVehiclesRes,
      approvedOwnersRes,
      bookingsByStatusRes,
      revenueRes,
      commissionsRes,
      pendingPayoutsRes,
      pendingReviewsRes,
    ] = await Promise.all([
      svc
        .from('fleet_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      svc
        .from('fleet_owners')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
      svc
        .from('rental_bookings')
        .select('status'),
      svc
        .from('rental_bookings')
        .select('total_rental_cents')
        .eq('status', 'completed'),
      svc
        .from('rental_bookings')
        .select('commission_cents')
        .eq('status', 'completed'),
      svc
        .from('fleet_payouts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      svc
        .from('fleet_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_review'),
    ])

    // Aggregate bookings by status
    const bookingsByStatus: Record<string, number> = {}
    if (bookingsByStatusRes.data) {
      for (const row of bookingsByStatusRes.data) {
        const s = (row as { status: string }).status
        bookingsByStatus[s] = (bookingsByStatus[s] ?? 0) + 1
      }
    }

    // Sum revenue
    const totalRevenue = revenueRes.data
      ? revenueRes.data.reduce((sum, row) => sum + ((row as { total_rental_cents: number }).total_rental_cents ?? 0), 0)
      : 0

    // Sum commissions
    const totalCommissions = commissionsRes.data
      ? commissionsRes.data.reduce((sum, row) => sum + ((row as { commission_cents: number }).commission_cents ?? 0), 0)
      : 0

    const metrics = {
      totalActiveVehicles: activeVehiclesRes.count ?? 0,
      totalApprovedOwners: approvedOwnersRes.count ?? 0,
      bookingsByStatus,
      totalRevenueCents: totalRevenue,
      totalCommissionsCents: totalCommissions,
      pendingPayouts: pendingPayoutsRes.count ?? 0,
      pendingVehicleReviews: pendingReviewsRes.count ?? 0,
    }

    console.log('[Fleet Admin] Metrics fetched')
    return apiSuccess({ metrics })
  } catch (error) {
    console.error('[Fleet Admin] metrics error:', error)
    return apiError(error)
  }
}
