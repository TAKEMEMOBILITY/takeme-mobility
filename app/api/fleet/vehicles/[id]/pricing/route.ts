import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { z } from 'zod'
import { setPricing } from '@/lib/fleet/services/vehicle.service'

const pricingSchema = z.object({
  dailyRateCents: z.coerce.number().int(),
  weeklyRateCents: z.coerce.number().int().optional(),
  monthlyRateCents: z.coerce.number().int().optional(),
  depositAmountCents: z.coerce.number().int().optional(),
  mileageLimitDaily: z.coerce.number().int().optional(),
  excessMileageCents: z.coerce.number().int().optional(),
  cleaningFeeCents: z.coerce.number().int().optional(),
})

// PUT — Set pricing
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const validated = pricingSchema.parse(body)

    const svc = createServiceClient()
    const { data: owner } = await svc
      .from('fleet_owners')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!owner) return NextResponse.json({ error: 'Not a fleet owner' }, { status: 403 })

    await setPricing(id, owner.id, validated)

    return apiSuccess({ updated: true })
  } catch (error) {
    return apiError(error)
  }
}
