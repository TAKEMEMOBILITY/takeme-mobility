import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { cancelBooking } from '@/lib/fleet/services/booking.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const result = await cancelBooking(id, user.id, body?.reason ?? 'driver_cancelled')
    return apiSuccess({ cancelled: true })
  } catch (error) {
    return apiError(error)
  }
}
