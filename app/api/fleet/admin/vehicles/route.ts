import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'

// GET — List vehicles by status (admin only)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const url = new URL(request.url)
    const status = url.searchParams.get('status') ?? 'pending_review'

    const svc = createServiceClient()
    const { data: vehicles, error } = await svc
      .from('fleet_vehicles')
      .select('*, vehicle_photos(*)')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Fleet Admin] vehicles list error:', error)
      return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 })
    }

    console.log(`[Fleet Admin] Listed ${vehicles?.length ?? 0} vehicles with status=${status}`)
    return apiSuccess({ vehicles })
  } catch (error) {
    console.error('[Fleet Admin] vehicles list error:', error)
    return apiError(error)
  }
}
