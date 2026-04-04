import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { deletePhoto } from '@/lib/fleet/services/vehicle.service'

// DELETE — Delete photo
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; idx: string }> },
) {
  try {
    const { id, idx } = await params

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

    await deletePhoto(id, owner.id, idx)

    return apiSuccess({ deleted: true })
  } catch (error) {
    return apiError(error)
  }
}
