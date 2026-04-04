import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { submitForReview } from '@/lib/fleet/services/vehicle.service'

// POST — Submit vehicle for review
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: owner } = await svc
      .from('fleet_owners')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!owner) return NextResponse.json({ error: 'Not a fleet owner' }, { status: 403 })

    await submitForReview(id, owner.id)

    return apiSuccess({ submitted: true })
  } catch (error) {
    return apiError(error)
  }
}
