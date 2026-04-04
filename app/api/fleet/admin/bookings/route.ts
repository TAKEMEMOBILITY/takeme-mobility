import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'

// GET — List all bookings with filters (admin only)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const vehicleId = url.searchParams.get('vehicleId')
    const driverId = url.searchParams.get('driverId')
    const ownerId = url.searchParams.get('ownerId')
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50

    const svc = createServiceClient()
    let query = svc
      .from('rental_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)
    if (vehicleId) query = query.eq('vehicle_id', vehicleId)
    if (driverId) query = query.eq('driver_id', driverId)
    if (ownerId) query = query.eq('owner_id', ownerId)

    const { data: bookings, error } = await query

    if (error) {
      console.error('[Fleet Admin] bookings list error:', error)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    console.log(`[Fleet Admin] Listed ${bookings?.length ?? 0} bookings`)
    return apiSuccess({ bookings })
  } catch (error) {
    console.error('[Fleet Admin] bookings list error:', error)
    return apiError(error)
  }
}
