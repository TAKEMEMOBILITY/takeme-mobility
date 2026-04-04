import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOwner, startStripeOnboarding, syncStripeStatus } from '@/lib/fleet/services/owner.service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'

const stripeOnboardingSchema = z.object({
  returnUrl: z.string().url('A valid return URL is required'),
  refreshUrl: z.string().url('A valid refresh URL is required'),
})

// POST — Start Stripe Connect onboarding
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    console.log('[fleet/owners/stripe] POST start Stripe onboarding', { ownerId: id })

    const owner = await getOwner(id)
    if (owner.auth_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validated = stripeOnboardingSchema.parse(body)

    const result = await startStripeOnboarding(id, validated.returnUrl, validated.refreshUrl)

    return apiSuccess({ url: result.url })
  } catch (error) {
    console.log('[fleet/owners/stripe] POST error', error)
    return apiError(error)
  }
}

// GET — Sync Stripe status and return updated profile
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    console.log('[fleet/owners/stripe] GET sync Stripe status', { ownerId: id })

    const owner = await getOwner(id)
    if (owner.auth_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await syncStripeStatus(id)

    // Fetch updated owner to get fresh profile data
    const updatedOwner = await getOwner(id)

    return apiSuccess(updatedOwner.fleet_owner_profiles)
  } catch (error) {
    console.log('[fleet/owners/stripe] GET error', error)
    return apiError(error)
  }
}
