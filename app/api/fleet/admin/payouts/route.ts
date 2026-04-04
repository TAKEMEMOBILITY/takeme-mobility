import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'

// GET — List payouts by status (admin only)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const url = new URL(request.url)
    const status = url.searchParams.get('status') ?? 'pending'

    const svc = createServiceClient()
    const { data: payouts, error } = await svc
      .from('fleet_payouts')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Fleet Admin] payouts list error:', error)
      return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 })
    }

    console.log(`[Fleet Admin] Listed ${payouts?.length ?? 0} payouts with status=${status}`)
    return apiSuccess({ payouts })
  } catch (error) {
    console.error('[Fleet Admin] payouts list error:', error)
    return apiError(error)
  }
}
