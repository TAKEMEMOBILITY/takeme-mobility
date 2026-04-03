import { createServiceClient } from '@/lib/supabase/service';

// ═══════════════════════════════════════════════════════════════════════════
// Fleet Owner Onboarding
// Step tracking, status management, activation gating
// ═══════════════════════════════════════════════════════════════════════════

type OwnerStatus = 'started' | 'pending_documents' | 'pending_kyc' | 'pending_contract' | 'pending_vehicle_review' | 'approved' | 'rejected' | 'suspended';

interface OnboardingProgress {
  step: number;
  status: OwnerStatus;
  profileComplete: boolean;
  kycComplete: boolean;
  insuranceUploaded: boolean;
  masterAgreementSigned: boolean;
  vehicleCreated: boolean;
  vehicleDocumentsComplete: boolean;
  adminApproved: boolean;
  missingItems: string[];
}

export async function getOnboardingProgress(ownerId: string): Promise<OnboardingProgress> {
  const svc = createServiceClient();
  const missing: string[] = [];

  const [owner, profile, kyc, insurance, contracts, vehicles] = await Promise.all([
    svc.from('fleet_owners').select('status, onboarding_step').eq('id', ownerId).single(),
    svc.from('fleet_owner_profiles').select('full_name, business_name, address_line1').eq('owner_id', ownerId).single(),
    svc.from('fleet_owner_kyc').select('status').eq('owner_id', ownerId).single(),
    svc.from('insurance_policies').select('id').eq('owner_id', ownerId).limit(1),
    svc.from('contracts').select('id, status').eq('owner_id', ownerId).eq('type', 'master_agreement').eq('status', 'executed').limit(1),
    svc.from('fleet_vehicles').select('id, status').eq('owner_id', ownerId).limit(1),
  ]);

  const profileComplete = !!(profile.data?.full_name && profile.data?.address_line1);
  if (!profileComplete) missing.push('Complete your profile');

  const kycComplete = kyc.data?.status === 'verified';
  if (!kycComplete) missing.push('Complete identity verification');

  const insuranceUploaded = (insurance.data?.length ?? 0) > 0;
  if (!insuranceUploaded) missing.push('Upload insurance');

  const masterAgreementSigned = (contracts.data?.length ?? 0) > 0;
  if (!masterAgreementSigned) missing.push('Sign fleet partner agreement');

  const vehicleCreated = (vehicles.data?.length ?? 0) > 0;
  if (!vehicleCreated) missing.push('Add your first vehicle');

  const vehicleDocsComplete = vehicles.data?.[0]?.status !== 'pending_documents';
  if (vehicleCreated && !vehicleDocsComplete) missing.push('Upload vehicle documents');

  const adminApproved = owner.data?.status === 'approved';

  return {
    step: owner.data?.onboarding_step ?? 1,
    status: (owner.data?.status ?? 'started') as OwnerStatus,
    profileComplete,
    kycComplete,
    insuranceUploaded,
    masterAgreementSigned,
    vehicleCreated,
    vehicleDocumentsComplete: vehicleDocsComplete,
    adminApproved,
    missingItems: missing,
  };
}

/**
 * Check if a vehicle can be activated. Returns reasons if not.
 */
export async function canActivateVehicle(vehicleId: string): Promise<{ canActivate: boolean; blockers: string[] }> {
  const svc = createServiceClient();
  const blockers: string[] = [];

  const { data: vehicle } = await svc
    .from('fleet_vehicles')
    .select('id, owner_id, vin, status')
    .eq('id', vehicleId)
    .single();

  if (!vehicle) return { canActivate: false, blockers: ['Vehicle not found'] };

  // Ownership verification
  const { data: ownerDocs } = await svc.from('ownership_verification_docs')
    .select('verified').eq('vehicle_id', vehicleId).eq('verified', true).limit(1);
  if (!ownerDocs?.length) blockers.push('Ownership verification missing');

  // Insurance
  const { data: insurance } = await svc.from('insurance_policies')
    .select('expiry_date').eq('vehicle_id', vehicleId).gte('expiry_date', new Date().toISOString().slice(0, 10)).limit(1);
  if (!insurance?.length) blockers.push('Valid insurance required');

  // Master agreement
  const { data: masterContract } = await svc.from('contracts')
    .select('id').eq('owner_id', vehicle.owner_id).eq('type', 'master_agreement').eq('status', 'executed').limit(1);
  if (!masterContract?.length) blockers.push('Master agreement not executed');

  // Vehicle schedule contract
  const { data: scheduleContract } = await svc.from('contracts')
    .select('id').eq('vehicle_id', vehicleId).eq('type', 'vehicle_schedule').eq('status', 'executed').limit(1);
  if (!scheduleContract?.length) blockers.push('Vehicle schedule not executed');

  // Photos (minimum 4)
  const { data: photos } = await svc.from('vehicle_photos').select('id').eq('vehicle_id', vehicleId);
  if ((photos?.length ?? 0) < 4) blockers.push('Minimum 4 photos required');

  // Registration doc
  const { data: regDocs } = await svc.from('vehicle_documents')
    .select('verified').eq('vehicle_id', vehicleId).eq('doc_type', 'registration').eq('verified', true).limit(1);
  if (!regDocs?.length) blockers.push('Vehicle registration not verified');

  return { canActivate: blockers.length === 0, blockers };
}
