import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { getCachedEligibility } from '@/lib/fleet/services/eligibility.service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const vehicleId = new URL(request.url).searchParams.get('vehicleId')
    if (!vehicleId) {
      return NextResponse.json({ error: 'Missing vehicleId query parameter' }, { status: 400 })
    }

    const result = await getCachedEligibility(user.id, vehicleId)
    if (!result) {
      return apiSuccess({ eligible: false, cached: false })
    }
    return apiSuccess(result)
  } catch (error) {
    return apiError(error)
  }
}
