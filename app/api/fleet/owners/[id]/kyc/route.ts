import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOwner, startKyc } from '@/lib/fleet/services/owner.service'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'

const startKycSchema = z.object({
  returnUrl: z.string().url('A valid return URL is required'),
})

// POST — Start KYC verification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    console.log('[fleet/owners/kyc] POST start KYC', { ownerId: id })

    const owner = await getOwner(id)
    if (owner.auth_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validated = startKycSchema.parse(body)

    const result = await startKyc(id, validated.returnUrl)

    return apiSuccess({ url: result.url })
  } catch (error) {
    console.log('[fleet/owners/kyc] POST error', error)
    return apiError(error)
  }
}

// GET — Check KYC status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    console.log('[fleet/owners/kyc] GET KYC status', { ownerId: id })

    const owner = await getOwner(id)
    if (owner.auth_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const kyc = owner.fleet_owner_kyc
    return apiSuccess(kyc)
  } catch (error) {
    console.log('[fleet/owners/kyc] GET error', error)
    return apiError(error)
  }
}
