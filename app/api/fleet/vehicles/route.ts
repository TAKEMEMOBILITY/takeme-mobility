import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { z } from 'zod'
import { createVehicle, listMarketplace } from '@/lib/fleet/services/vehicle.service'

const createVehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100),
  vin: z.string().optional(),
  plate: z.string().optional(),
  color: z.string().optional(),
  bodyType: z.string().optional(),
  seating: z.coerce.number().int().optional(),
  rangeMiles: z.coerce.number().optional(),
  chargingType: z.string().optional(),
  connectorType: z.string().optional(),
  batteryCapacityKwh: z.coerce.number().optional(),
  performanceCategory: z.string().optional(),
  pickupAddress: z.string().optional(),
  pickupInstructions: z.string().optional(),
  dailyRateCents: z.coerce.number().int().min(1),
  weeklyRateCents: z.coerce.number().int().optional(),
  monthlyRateCents: z.coerce.number().int().optional(),
  depositAmountCents: z.coerce.number().int().optional(),
  minRentalDays: z.coerce.number().int().optional(),
  minDriverAge: z.coerce.number().int().optional(),
  mileageLimitDaily: z.coerce.number().int().optional(),
  excessMileageCents: z.coerce.number().int().optional(),
  cleaningFeeCents: z.coerce.number().int().optional(),
  accessories: z.array(z.string()).optional(),
  ownerNotes: z.string().optional(),
})

// POST — Create vehicle (auth + owner required)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const validated = createVehicleSchema.parse(body)

    const svc = createServiceClient()
    const { data: owner } = await svc
      .from('fleet_owners')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!owner) return NextResponse.json({ error: 'Not a fleet owner' }, { status: 403 })

    const result = await createVehicle(owner.id, validated)

    return apiSuccess({ vehicleId: result.id })
  } catch (error) {
    return apiError(error)
  }
}

// GET — Browse marketplace (public, no auth required)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)

    const filters = {
      city: url.searchParams.get('city') ?? undefined,
      type: url.searchParams.get('type') ?? undefined,
      minRange: url.searchParams.get('minRange')
        ? Number(url.searchParams.get('minRange'))
        : undefined,
      maxPrice: url.searchParams.get('maxPrice')
        ? Number(url.searchParams.get('maxPrice'))
        : undefined,
      startDate: url.searchParams.get('startDate') ?? undefined,
      endDate: url.searchParams.get('endDate') ?? undefined,
      page: url.searchParams.get('page')
        ? Number(url.searchParams.get('page'))
        : undefined,
      limit: url.searchParams.get('limit')
        ? Number(url.searchParams.get('limit'))
        : undefined,
    }

    const result = await listMarketplace(filters)

    return apiSuccess(result)
  } catch (error) {
    return apiError(error)
  }
}
