import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { z } from 'zod'
import { createBooking, listDriverBookings } from '@/lib/fleet/services/booking.service'

const CreateBookingSchema = z.object({
  vehicleId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  pickupAddress: z.string().optional(),
  pickupNotes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const idempotencyKey = request.headers.get('x-idempotency-key')
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Missing x-idempotency-key header' }, { status: 400 })
    }

    const body = CreateBookingSchema.parse(await request.json())
    const booking = await createBooking(user.id, body, idempotencyKey)
    return apiSuccess(booking, 201)
  } catch (error) {
    return apiError(error)
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const bookings = await listDriverBookings(user.id)
    return apiSuccess({ bookings })
  } catch (error) {
    return apiError(error)
  }
}
