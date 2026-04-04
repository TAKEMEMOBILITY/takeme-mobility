import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { FleetError, FleetErrorCode } from '@/lib/fleet/errors'

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: 'Validation error', details: error.issues.map(i => i.message) },
      { status: 400 },
    )
  }
  if (error instanceof FleetError) {
    const map: Record<FleetErrorCode, number> = {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      ALREADY_EXISTS: 409,
      INVALID_STATUS: 422,
      INVALID_DATES: 400,
      VALIDATION_ERROR: 400,
      VEHICLE_UNAVAILABLE: 409,
      DRIVER_INELIGIBLE: 422,
      KYC_REQUIRED: 403,
      UPLOAD_ERROR: 500,
      DB_ERROR: 500,
      CONFLICT: 409,
    }
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: map[error.code] ?? 500 },
    )
  }
  console.error('[Fleet]', error)
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
}
