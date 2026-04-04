import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOwnerByUserId } from '@/lib/fleet/services/owner.service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'

// GET — Get own owner profile (alias for /api/fleet/owners GET)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    console.log('[fleet/owners/me] GET owner profile', { userId: user.id })

    const owner = await getOwnerByUserId(user.id)
    if (!owner) {
      return NextResponse.json({ success: false, error: 'Not a fleet owner' }, { status: 404 })
    }

    return apiSuccess(owner)
  } catch (error) {
    console.log('[fleet/owners/me] GET error', error)
    return apiError(error)
  }
}
