import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { z } from 'zod'
import { getVehicle, updateVehicle } from '@/lib/fleet/services/vehicle.service'

const updateVehicleSchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
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
  dailyRateCents: z.coerce.number().int().optional(),
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

// GET — Get vehicle (public)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const vehicle = await getVehicle(id)
    return apiSuccess(vehicle)
  } catch (error) {
    return apiError(error)
  }
}

// PATCH — Update vehicle (auth + owner required)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const validated = updateVehicleSchema.parse(body)

    const svc = createServiceClient()
    const { data: owner } = await svc
      .from('fleet_owners')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!owner) return NextResponse.json({ error: 'Not a fleet owner' }, { status: 403 })

    await updateVehicle(id, owner.id, validated)

    return apiSuccess({ updated: true })
  } catch (error) {
    return apiError(error)
  }
}
