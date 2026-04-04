import { createServiceClient } from '@/lib/supabase/service'
import { FleetError, FleetErrorCode } from '@/lib/fleet/errors'

export async function logFleetAudit(params: {
  entityType: string
  entityId: string
  actorId: string
  actorRole: string
  event: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}) {
  try {
    const svc = createServiceClient()

    switch (params.entityType) {
      case 'vehicle': {
        const { error } = await svc.from('fleet_vehicle_audit').insert({
          vehicle_id: params.entityId,
          actor_id: params.actorId,
          actor_role: params.actorRole,
          action: params.event,
          new_value: params.metadata ?? null,
        })

        if (error) {
          console.error('[AuditService] Failed to insert vehicle audit record:', error.message)
        }
        break
      }

      case 'booking': {
        const { error } = await svc.from('rental_booking_status_history').insert({
          booking_id: params.entityId,
          new_status: params.event,
          changed_by: params.actorId,
          reason: (params.metadata?.reason as string) ?? null,
        })

        if (error) {
          console.error('[AuditService] Failed to insert booking audit record:', error.message)
        }
        break
      }

      case 'contract': {
        const { error } = await svc.from('fleet_contract_events').insert({
          contract_id: params.entityId,
          event: params.event,
          actor_id: params.actorId,
          actor_role: params.actorRole,
          metadata: params.metadata ?? null,
          ip_address: params.ipAddress ?? null,
        })

        if (error) {
          console.error('[AuditService] Failed to insert contract audit record:', error.message)
        }
        break
      }

      default: {
        console.error(
          `[AuditService] Unknown entity type: ${params.entityType}. Event "${params.event}" for entity ${params.entityId} was not recorded.`,
        )
      }
    }
  } catch (err) {
    console.error(
      '[AuditService] Unexpected error logging audit for',
      params.entityType,
      params.entityId,
      ':',
      err instanceof Error ? err.message : err,
    )
  }
}
