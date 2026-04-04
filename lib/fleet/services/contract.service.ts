import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { FleetError, FleetErrorCode } from '@/lib/fleet/errors'

const PLATFORM_SIGNER_ID = 'platform'
const PLATFORM_SIGNER_EMAIL = 'contracts@takememobility.com'
const PLATFORM_SIGNER_NAME = 'TakeMe Mobility'

export async function generateContract(params: {
  type: 'driver_rental_agreement'
  bookingId: string
  driverId: string
  ownerId: string
  vehicleId: string
  variables: Record<string, string>
}) {
  const svc = createServiceClient()

  // Get active template for this type
  const { data: template, error: templateErr } = await svc
    .from('contract_templates')
    .select('*')
    .eq('type', params.type)
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (templateErr || !template) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `No active contract template found for type: ${params.type}`)
  }

  // Render body by replacing all {{placeholder}} occurrences
  let renderedBody = template.body_template as string
  for (const [key, value] of Object.entries(params.variables)) {
    renderedBody = renderedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  // Compute SHA-256 hash of rendered body
  const documentHash = crypto.createHash('sha256').update(renderedBody).digest('hex')

  // Insert contract
  const { data: contract, error: contractErr } = await svc
    .from('contracts')
    .insert({
      template_id: template.id,
      type: params.type,
      status: 'pending_signature',
      owner_id: params.ownerId,
      vehicle_id: params.vehicleId,
      driver_id: params.driverId,
      booking_id: params.bookingId,
      rendered_body: renderedBody,
      variables: params.variables,
      document_hash: documentHash,
      version: template.version,
    })
    .select('id')
    .single()

  if (contractErr || !contract) {
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to create contract: ${contractErr?.message}`)
  }

  // Insert signer records: driver + platform auto-signer
  const signers = [
    {
      contract_id: contract.id,
      signer_role: 'driver',
      signer_user_id: params.driverId,
      signer_email: null,
      signer_name: null,
      signed: false,
    },
    {
      contract_id: contract.id,
      signer_role: 'platform',
      signer_user_id: PLATFORM_SIGNER_ID,
      signer_email: PLATFORM_SIGNER_EMAIL,
      signer_name: PLATFORM_SIGNER_NAME,
      signed: false,
    },
  ]

  const { error: signersErr } = await svc.from('contract_signers').insert(signers)

  if (signersErr) {
    console.error('[ContractService] Failed to insert signers:', signersErr.message)
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to create contract signers: ${signersErr.message}`)
  }

  // Log contract generated event
  const { error: eventErr } = await svc.from('fleet_contract_events').insert({
    contract_id: contract.id,
    event: 'contract_generated',
    actor_id: params.driverId,
    actor_role: 'driver',
    metadata: {
      template_id: template.id,
      template_version: template.version,
      booking_id: params.bookingId,
    },
  })

  if (eventErr) {
    console.error('[ContractService] Failed to log contract_generated event:', eventErr.message)
  }

  return contract.id
}

export async function signContract(
  contractId: string,
  signerId: string,
  params: { ipAddress?: string; userAgent?: string },
) {
  const svc = createServiceClient()

  // Get contract
  const { data: contract, error: contractErr } = await svc
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (contractErr || !contract) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Contract ${contractId} not found`)
  }

  if (contract.status === 'revoked' || contract.status === 'expired' || contract.status === 'declined') {
    throw new FleetError(FleetErrorCode.INVALID_STATUS, `Contract is ${contract.status} and cannot be signed`)
  }

  // Get signer record matching signerId
  const { data: signer, error: signerErr } = await svc
    .from('contract_signers')
    .select('*')
    .eq('contract_id', contractId)
    .eq('signer_user_id', signerId)
    .single()

  if (signerErr || !signer) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Signer ${signerId} not found for contract ${contractId}`)
  }

  if (signer.signed) {
    throw new FleetError(FleetErrorCode.CONFLICT, `Signer ${signerId} has already signed contract ${contractId}`)
  }

  // Compute signature hash
  const signatureHash = crypto
    .createHash('sha256')
    .update(`${signerId}:${Date.now()}:${contract.document_hash}`)
    .digest('hex')

  // Update signer record
  const { error: updateSignerErr } = await svc
    .from('contract_signers')
    .update({
      signed: true,
      signed_at: new Date().toISOString(),
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    })
    .eq('id', signer.id)

  if (updateSignerErr) {
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to update signer: ${updateSignerErr.message}`)
  }

  // Log signing event
  const { error: eventErr } = await svc.from('fleet_contract_events').insert({
    contract_id: contractId,
    event: 'contract_signed',
    actor_id: signerId,
    actor_role: signer.signer_role,
    metadata: { signature_hash: signatureHash },
    ip_address: params.ipAddress ?? null,
  })

  if (eventErr) {
    console.error('[ContractService] Failed to log contract_signed event:', eventErr.message)
  }

  // Auto-countersign platform signer if the driver just signed
  if (signer.signer_role === 'driver') {
    const platformSignatureHash = crypto
      .createHash('sha256')
      .update(`${PLATFORM_SIGNER_ID}:${Date.now()}:${contract.document_hash}`)
      .digest('hex')

    const { error: platformErr } = await svc
      .from('contract_signers')
      .update({
        signed: true,
        signed_at: new Date().toISOString(),
      })
      .eq('contract_id', contractId)
      .eq('signer_user_id', PLATFORM_SIGNER_ID)

    if (platformErr) {
      console.error('[ContractService] Failed to auto-countersign platform signer:', platformErr.message)
    } else {
      const { error: platformEventErr } = await svc.from('fleet_contract_events').insert({
        contract_id: contractId,
        event: 'contract_signed',
        actor_id: PLATFORM_SIGNER_ID,
        actor_role: 'platform',
        metadata: { signature_hash: platformSignatureHash, auto_countersigned: true },
      })

      if (platformEventErr) {
        console.error('[ContractService] Failed to log platform auto-sign event:', platformEventErr.message)
      }
    }
  }

  // Check if all signers have signed
  const { data: allSigners, error: allSignersErr } = await svc
    .from('contract_signers')
    .select('signed')
    .eq('contract_id', contractId)

  if (allSignersErr) {
    console.error('[ContractService] Failed to check all signers:', allSignersErr.message)
  }

  const allSigned = allSigners && allSigners.length > 0 && allSigners.every((s) => s.signed)

  if (allSigned) {
    const { error: execErr } = await svc
      .from('contracts')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
      })
      .eq('id', contractId)

    if (execErr) {
      console.error('[ContractService] Failed to update contract to executed:', execErr.message)
    }
  } else {
    const { error: partialErr } = await svc
      .from('contracts')
      .update({ status: 'partially_signed' })
      .eq('id', contractId)

    if (partialErr) {
      console.error('[ContractService] Failed to update contract to partially_signed:', partialErr.message)
    }
  }

  // Return updated contract
  const { data: updated, error: updatedErr } = await svc
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (updatedErr || !updated) {
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to fetch updated contract: ${updatedErr?.message}`)
  }

  return updated
}

export async function voidContract(contractId: string, actorId: string, reason: string) {
  const svc = createServiceClient()

  const { data: contract, error: contractErr } = await svc
    .from('contracts')
    .select('id, status')
    .eq('id', contractId)
    .single()

  if (contractErr || !contract) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Contract ${contractId} not found`)
  }

  const { error: updateErr } = await svc
    .from('contracts')
    .update({ status: 'revoked' })
    .eq('id', contractId)

  if (updateErr) {
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to void contract: ${updateErr.message}`)
  }

  const { error: eventErr } = await svc.from('fleet_contract_events').insert({
    contract_id: contractId,
    event: 'contract_voided',
    actor_id: actorId,
    actor_role: 'admin',
    metadata: { reason, previous_status: contract.status },
  })

  if (eventErr) {
    console.error('[ContractService] Failed to log contract_voided event:', eventErr.message)
  }
}

export async function getContract(contractId: string) {
  const svc = createServiceClient()

  const { data: contract, error: contractErr } = await svc
    .from('contracts')
    .select('*, contract_signers(*), fleet_contract_events(*)')
    .eq('id', contractId)
    .single()

  if (contractErr || !contract) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Contract ${contractId} not found`)
  }

  return contract
}
