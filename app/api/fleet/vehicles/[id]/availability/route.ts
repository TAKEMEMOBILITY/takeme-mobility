import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { z } from 'zod'
import { blockDates } from '@/lib/fleet/services/vehicle.service'

const blockDatesSchema = z.object({
  from: z.string().min(1),
  until: z.string().min(1),
  reason: z.string().optional(),
})

// POST — Block dates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const validated = blockDatesSchema.parse(body)

    const svc = createServiceClient()
    const { data: owner } = await svc
      .from('fleet_owners')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!owner) return NextResponse.json({ error: 'Not a fleet owner' }, { status: 403 })

    await blockDates(id, owner.id, validated)

    return apiSuccess({ blocked: true })
  } catch (error) {
    return apiError(error)
  }
}
