import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { rejectVehicle } from '@/lib/fleet/services/vehicle.service'
import { z } from 'zod'

const rejectSchema = z.object({
  reason: z.string().min(1),
})

// POST — Reject vehicle (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error
    const adminId = auth.user.id

    const { id } = await params
    const body = rejectSchema.parse(await request.json())

    await rejectVehicle(id, adminId, body.reason)

    console.log(`[Fleet Admin] Vehicle ${id} rejected by admin ${adminId}`)
    return apiSuccess({ rejected: true })
  } catch (error) {
    console.error('[Fleet Admin] vehicle reject error:', error)
    return apiError(error)
  }
}
