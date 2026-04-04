import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { apiSuccess, apiError } from '@/lib/fleet/utils/api'
import { releasePayout } from '@/lib/fleet/services/payout.service'

// POST — Release payout (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error
    const adminId = auth.user.id

    const { id } = await params

    await releasePayout(id, adminId)

    console.log(`[Fleet Admin] Payout ${id} released by admin ${adminId}`)
    return apiSuccess({ released: true })
  } catch (error) {
    console.error('[Fleet Admin] payout release error:', error)
    return apiError(error)
  }
}
