import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { registerOwner, getOwnerByUserId } from '@/lib/fleet/services/owner.service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'

const registerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  businessName: z.string().optional(),
  businessType: z.string().optional(),
})

// POST — Register as fleet owner
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const validated = registerSchema.parse(body)

    console.log('[fleet/owners] POST register', { userId: user.id })

    const result = await registerOwner(user.id, user.email!, validated)

    return apiSuccess({ ownerId: result.id }, 201)
  } catch (error) {
    console.log('[fleet/owners] POST error', error)
    return apiError(error)
  }
}

// GET — Get own owner profile
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    console.log('[fleet/owners] GET owner profile', { userId: user.id })

    const owner = await getOwnerByUserId(user.id)
    if (!owner) {
      return NextResponse.json({ success: false, error: 'Not a fleet owner' }, { status: 404 })
    }

    return apiSuccess(owner)
  } catch (error) {
    console.log('[fleet/owners] GET error', error)
    return apiError(error)
  }
}
