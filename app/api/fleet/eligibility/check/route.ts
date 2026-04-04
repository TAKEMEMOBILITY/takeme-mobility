import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { z } from 'zod'
import { checkEligibility } from '@/lib/fleet/services/eligibility.service'

const CheckEligibilitySchema = z.object({
  vehicleId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = CheckEligibilitySchema.parse(await request.json())
    const result = await checkEligibility(user.id, body.vehicleId)
    return apiSuccess(result)
  } catch (error) {
    return apiError(error)
  }
}
