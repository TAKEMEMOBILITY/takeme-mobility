import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// Fleet Contract Engine
// Template rendering, signature orchestration, lifecycle management
// ═══════════════════════════════════════════════════════════════════════════

type ContractType = 'master_agreement' | 'vehicle_schedule' | 'driver_rental_agreement';
type ContractStatus = 'draft' | 'pending_signature' | 'partially_signed' | 'executed' | 'declined' | 'expired' | 'revoked';

export async function createContract(params: {
  type: ContractType;
  ownerId?: string;
  vehicleId?: string;
  driverId?: string;
  bookingId?: string;
  variables: Record<string, string | number>;
  signerEmails: Array<{ email: string; role: string; name?: string; userId?: string }>;
}): Promise<{ contractId: string } | { error: string }> {
  const svc = createServiceClient();

  // Get active template
  const { data: template } = await svc
    .from('contract_templates')
    .select('*')
    .eq('type', params.type)
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (!template) return { error: `No active template for ${params.type}` };

  // Render body
  let rendered = template.body_template as string;
  for (const [key, value] of Object.entries(params.variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }

  const documentHash = crypto.createHash('sha256').update(rendered).digest('hex');

  // Create contract
  const { data: contract, error } = await svc
    .from('contracts')
    .insert({
      template_id: template.id,
      type: params.type,
      status: 'pending_signature',
      owner_id: params.ownerId ?? null,
      vehicle_id: params.vehicleId ?? null,
      driver_id: params.driverId ?? null,
      booking_id: params.bookingId ?? null,
      rendered_body: rendered,
      variables: params.variables,
      document_hash: documentHash,
      version: template.version,
    })
    .select('id')
    .single();

  if (error || !contract) return { error: error?.message ?? 'Failed to create contract' };

  // Create signers
  for (const signer of params.signerEmails) {
    await svc.from('contract_signers').insert({
      contract_id: contract.id,
      signer_role: signer.role,
      signer_user_id: signer.userId ?? null,
      signer_email: signer.email,
      signer_name: signer.name ?? null,
    });
  }

  // Audit
  await logContractEvent(contract.id, 'created', undefined, undefined, 'pending_signature' as ContractStatus);

  return { contractId: contract.id };
}

export async function signContract(
  contractId: string,
  signerEmail: string,
  ip: string,
  userAgent: string,
): Promise<{ success: boolean; error?: string; executed?: boolean }> {
  const svc = createServiceClient();

  // Find signer
  const { data: signer } = await svc
    .from('contract_signers')
    .select('*')
    .eq('contract_id', contractId)
    .eq('signer_email', signerEmail)
    .single();

  if (!signer) return { success: false, error: 'Signer not found' };
  if (signer.signed) return { success: false, error: 'Already signed' };

  // Mark signed
  await svc.from('contract_signers')
    .update({ signed: true, signed_at: new Date().toISOString(), ip_address: ip, user_agent: userAgent })
    .eq('id', signer.id);

  // Log signature event
  await svc.from('contract_signature_events').insert({
    contract_id: contractId,
    signer_id: signer.id,
    event_type: 'signed',
    ip_address: ip,
    user_agent: userAgent,
  });

  // Check if all signers have signed
  const { data: allSigners } = await svc
    .from('contract_signers')
    .select('signed')
    .eq('contract_id', contractId);

  const allSigned = (allSigners ?? []).every(s => s.signed);

  if (allSigned) {
    await svc.from('contracts')
      .update({ status: 'executed', executed_at: new Date().toISOString() })
      .eq('id', contractId);
    await logContractEvent(contractId, 'executed', signerEmail, 'pending_signature', 'executed');
    return { success: true, executed: true };
  }

  await svc.from('contracts')
    .update({ status: 'partially_signed' })
    .eq('id', contractId);
  await logContractEvent(contractId, 'partially_signed', signerEmail, 'pending_signature', 'partially_signed');

  return { success: true, executed: false };
}

export async function hasExecutedContract(
  type: ContractType,
  ownerId?: string,
  vehicleId?: string,
): Promise<boolean> {
  const svc = createServiceClient();
  let query = svc.from('contracts').select('id').eq('type', type).eq('status', 'executed');
  if (ownerId) query = query.eq('owner_id', ownerId);
  if (vehicleId) query = query.eq('vehicle_id', vehicleId);
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

async function logContractEvent(
  contractId: string, action: string, actorEmail?: string,
  prevStatus?: ContractStatus, newStatus?: ContractStatus,
) {
  const svc = createServiceClient();
  await svc.from('contract_audit_events').insert({
    contract_id: contractId,
    action,
    actor_email: actorEmail ?? null,
    previous_status: prevStatus ?? null,
    new_status: newStatus ?? null,
  });
}
