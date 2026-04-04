import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'

// GET — List owners by status (admin only)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const kycStatus = url.searchParams.get('kyc_status')

    const svc = createServiceClient()

    let query = kycStatus
      ? svc.from('fleet_owners').select('*, fleet_owner_kyc(*)')
      : svc.from('fleet_owners').select('*')

    if (status) {
      query = query.eq('status', status)
    }

    if (kycStatus) {
      query = query.eq('fleet_owner_kyc.status', kycStatus)
    }

    const { data: owners, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('[Fleet Admin] owners list error:', error)
      return NextResponse.json({ error: 'Failed to fetch owners' }, { status: 500 })
    }

    console.log(`[Fleet Admin] Listed ${owners?.length ?? 0} owners`)
    return apiSuccess({ owners })
  } catch (error) {
    console.error('[Fleet Admin] owners list error:', error)
    return apiError(error)
  }
}
