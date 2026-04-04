import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { approveVehicle } from '@/lib/fleet/services/vehicle.service'

// POST — Approve vehicle (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error
    const adminId = auth.user.id

    const { id } = await params

    await approveVehicle(id, adminId)

    console.log(`[Fleet Admin] Vehicle ${id} approved by admin ${adminId}`)
    return apiSuccess({ approved: true })
  } catch (error) {
    console.error('[Fleet Admin] vehicle approve error:', error)
    return apiError(error)
  }
}
