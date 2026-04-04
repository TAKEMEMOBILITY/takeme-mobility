import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { createServiceClient } from '@/lib/supabase/service'
import { listOwnerPayouts } from '@/lib/fleet/services/payout.service'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: owner } = await svc
      .from('fleet_owners')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!owner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payouts = await listOwnerPayouts(owner.id)
    return apiSuccess({ payouts })
  } catch (error) {
    return apiError(error)
  }
}
