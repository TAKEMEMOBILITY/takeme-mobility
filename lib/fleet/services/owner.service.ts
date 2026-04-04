import { createServiceClient } from '@/lib/supabase/service';
import { FleetError, FleetErrorCode } from '@/lib/fleet/errors';
import {
  createConnectedAccount,
  createAccountLink,
  getConnectedAccount,
  createVerificationSession,
  getVerificationSession,
} from '@/lib/fleet/utils/stripe-connect';

// ═══════════════════════════════════════════════════════════════════════════
// TakeMe Fleet — Owner Service
// Registration, KYC, Stripe Connect onboarding, approval workflows
// ═══════════════════════════════════════════════════════════════════════════

const LOG_PREFIX = '[OwnerService]';

// ── Register a new fleet owner ─────────────────────────────────────────────

export async function registerOwner(
  userId: string,
  email: string,
  input: {
    fullName: string;
    phone?: string;
    businessName?: string;
    businessType?: string;
  },
) {
  const svc = createServiceClient();

  // Check if user is already registered
  const { data: existing, error: lookupError } = await svc
    .from('fleet_owners')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (lookupError) {
    console.error(LOG_PREFIX, 'Failed to check existing owner', lookupError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to check existing registration');
  }

  if (existing) {
    throw new FleetError(FleetErrorCode.ALREADY_EXISTS, 'User is already registered as a fleet owner');
  }

  // Insert fleet_owners row
  const { data: owner, error: ownerError } = await svc
    .from('fleet_owners')
    .insert({
      auth_user_id: userId,
      email,
      phone: input.phone ?? null,
      status: 'started',
      onboarding_step: 1,
      business_name: input.businessName ?? null,
      business_type: input.businessType ?? null,
    })
    .select('id')
    .single();

  if (ownerError || !owner) {
    console.error(LOG_PREFIX, 'Failed to insert fleet_owners', ownerError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to create owner record');
  }

  const ownerId = owner.id as string;

  // Insert profile and kyc rows in parallel
  const [profileResult, kycResult] = await Promise.all([
    svc.from('fleet_owner_profiles').insert({
      owner_id: ownerId,
      full_name: input.fullName,
      business_name: input.businessName ?? null,
      business_type: input.businessType ?? null,
    }),
    svc.from('fleet_owner_kyc').insert({
      owner_id: ownerId,
      status: 'not_started',
    }),
  ]);

  if (profileResult.error) {
    console.error(LOG_PREFIX, 'Failed to insert fleet_owner_profiles', profileResult.error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to create owner profile');
  }

  if (kycResult.error) {
    console.error(LOG_PREFIX, 'Failed to insert fleet_owner_kyc', kycResult.error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to create owner KYC record');
  }

  return { id: ownerId };
}

// ── Get owner with profile and KYC (by owner id) ──────────────────────────

export async function getOwner(ownerId: string) {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('fleet_owners')
    .select('*, fleet_owner_profiles(*), fleet_owner_kyc(*)')
    .eq('id', ownerId)
    .single();

  if (error || !data) {
    if (error?.code === 'PGRST116' || !data) {
      throw new FleetError(FleetErrorCode.NOT_FOUND, 'Fleet owner not found');
    }
    console.error(LOG_PREFIX, 'Failed to fetch owner', error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to fetch owner');
  }

  return data;
}

// ── Get owner by auth user id ──────────────────────────────────────────────

export async function getOwnerByUserId(userId: string) {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('fleet_owners')
    .select('*, fleet_owner_profiles(*), fleet_owner_kyc(*)')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (error) {
    console.error(LOG_PREFIX, 'Failed to fetch owner by user id', error);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to fetch owner by user id');
  }

  return data ?? null;
}

// ── Start KYC verification ─────────────────────────────────────────────────

export async function startKyc(ownerId: string, returnUrl: string) {
  const svc = createServiceClient();

  const session = await createVerificationSession({ ownerId, returnUrl });

  // Update KYC record
  const { error: kycError } = await svc
    .from('fleet_owner_kyc')
    .update({
      provider: 'stripe',
      provider_session_id: session.sessionId,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', ownerId);

  if (kycError) {
    console.error(LOG_PREFIX, 'Failed to update KYC record', kycError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to update KYC record');
  }

  // Advance owner status to pending_kyc
  const { error: ownerError } = await svc
    .from('fleet_owners')
    .update({
      status: 'pending_kyc',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ownerId);

  if (ownerError) {
    console.error(LOG_PREFIX, 'Failed to update owner status', ownerError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to update owner status');
  }

  return { url: session.url };
}

// ── Handle KYC webhook callback ────────────────────────────────────────────

export async function handleKycWebhook(
  sessionId: string,
  status: 'verified' | 'requires_input',
) {
  const svc = createServiceClient();

  // Look up the KYC record by provider_session_id
  const { data: kyc, error: lookupError } = await svc
    .from('fleet_owner_kyc')
    .select('id, owner_id')
    .eq('provider_session_id', sessionId)
    .single();

  if (lookupError || !kyc) {
    console.error(LOG_PREFIX, 'KYC record not found for session', sessionId, lookupError);
    throw new FleetError(FleetErrorCode.NOT_FOUND, 'KYC record not found for session');
  }

  const ownerId = kyc.owner_id as string;

  if (status === 'verified') {
    const { error: kycUpdateError } = await svc
      .from('fleet_owner_kyc')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', kyc.id);

    if (kycUpdateError) {
      console.error(LOG_PREFIX, 'Failed to update KYC to verified', kycUpdateError);
      throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to update KYC status');
    }

    // Advance owner status to pending_contract
    const { error: ownerUpdateError } = await svc
      .from('fleet_owners')
      .update({
        status: 'pending_contract',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ownerId);

    if (ownerUpdateError) {
      console.error(LOG_PREFIX, 'Failed to advance owner status after KYC', ownerUpdateError);
      throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to update owner status');
    }
  } else {
    // requires_input — fetch rejection details from Stripe
    const sessionDetails = await getVerificationSession(sessionId);
    const rejectionReason = sessionDetails.lastError
      ? `${sessionDetails.lastError.code}: ${sessionDetails.lastError.reason}`
      : 'Verification requires additional input';

    const { error: kycUpdateError } = await svc
      .from('fleet_owner_kyc')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', kyc.id);

    if (kycUpdateError) {
      console.error(LOG_PREFIX, 'Failed to update KYC to rejected', kycUpdateError);
      throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to update KYC status');
    }

    // Revert owner status so they can retry
    const { error: ownerUpdateError } = await svc
      .from('fleet_owners')
      .update({
        status: 'pending_documents',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ownerId);

    if (ownerUpdateError) {
      console.error(LOG_PREFIX, 'Failed to revert owner status after KYC rejection', ownerUpdateError);
      throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to update owner status');
    }
  }
}

// ── Start Stripe Connect onboarding ────────────────────────────────────────

export async function startStripeOnboarding(
  ownerId: string,
  returnUrl: string,
  refreshUrl: string,
) {
  const svc = createServiceClient();

  // Fetch owner + profile
  const { data: owner, error: ownerError } = await svc
    .from('fleet_owners')
    .select('email, business_type')
    .eq('id', ownerId)
    .single();

  if (ownerError || !owner) {
    console.error(LOG_PREFIX, 'Failed to fetch owner for Stripe onboarding', ownerError);
    throw new FleetError(FleetErrorCode.NOT_FOUND, 'Fleet owner not found');
  }

  const { data: profile, error: profileError } = await svc
    .from('fleet_owner_profiles')
    .select('stripe_account_id, business_type')
    .eq('owner_id', ownerId)
    .single();

  if (profileError || !profile) {
    console.error(LOG_PREFIX, 'Failed to fetch owner profile for Stripe onboarding', profileError);
    throw new FleetError(FleetErrorCode.NOT_FOUND, 'Fleet owner profile not found');
  }

  let accountId = profile.stripe_account_id as string | null;

  // Create connected account if one doesn't exist yet
  if (!accountId) {
    const account = await createConnectedAccount({
      email: owner.email as string,
      businessType: (profile.business_type as string) ?? 'individual',
      ownerId,
    });

    accountId = account.accountId;

    const { error: updateError } = await svc
      .from('fleet_owner_profiles')
      .update({
        stripe_account_id: accountId,
        updated_at: new Date().toISOString(),
      })
      .eq('owner_id', ownerId);

    if (updateError) {
      console.error(LOG_PREFIX, 'Failed to save Stripe account id', updateError);
      throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to save Stripe account');
    }
  }

  // Generate account link for onboarding
  const link = await createAccountLink(accountId, returnUrl, refreshUrl);

  return { url: link.url };
}

// ── Sync Stripe Connect account status ─────────────────────────────────────

export async function syncStripeStatus(ownerId: string) {
  const svc = createServiceClient();

  const { data: profile, error: profileError } = await svc
    .from('fleet_owner_profiles')
    .select('stripe_account_id')
    .eq('owner_id', ownerId)
    .single();

  if (profileError || !profile) {
    console.error(LOG_PREFIX, 'Failed to fetch profile for Stripe sync', profileError);
    throw new FleetError(FleetErrorCode.NOT_FOUND, 'Fleet owner profile not found');
  }

  const accountId = profile.stripe_account_id as string | null;
  if (!accountId) {
    throw new FleetError(FleetErrorCode.INVALID_STATUS, 'No Stripe account linked to this owner');
  }

  const account = await getConnectedAccount(accountId);

  const { error: updateError } = await svc
    .from('fleet_owner_profiles')
    .update({
      stripe_onboarding_complete: account.detailsSubmitted && account.payoutsEnabled,
      stripe_payouts_enabled: account.payoutsEnabled,
      stripe_details_submitted: account.detailsSubmitted,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', ownerId);

  if (updateError) {
    console.error(LOG_PREFIX, 'Failed to sync Stripe status', updateError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to sync Stripe status');
  }

  return {
    detailsSubmitted: account.detailsSubmitted,
    payoutsEnabled: account.payoutsEnabled,
    chargesEnabled: account.chargesEnabled,
  };
}

// ── Approve owner (admin action) ───────────────────────────────────────────

const APPROVABLE_STATUSES = new Set([
  'pending_vehicle_review',
  'pending_contract',
  'pending_kyc',
  'pending_documents',
]);

export async function approveOwner(ownerId: string, adminId: string) {
  const svc = createServiceClient();

  const { data: owner, error: fetchError } = await svc
    .from('fleet_owners')
    .select('status')
    .eq('id', ownerId)
    .single();

  if (fetchError || !owner) {
    console.error(LOG_PREFIX, 'Failed to fetch owner for approval', fetchError);
    throw new FleetError(FleetErrorCode.NOT_FOUND, 'Fleet owner not found');
  }

  if (!APPROVABLE_STATUSES.has(owner.status as string)) {
    throw new FleetError(
      FleetErrorCode.INVALID_STATUS,
      `Cannot approve owner with status "${owner.status}"`,
    );
  }

  const { error: updateError } = await svc
    .from('fleet_owners')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ownerId);

  if (updateError) {
    console.error(LOG_PREFIX, 'Failed to approve owner', updateError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to approve owner');
  }
}

// ── Suspend owner (admin action) ───────────────────────────────────────────

export async function suspendOwner(ownerId: string, adminId: string, reason: string) {
  const svc = createServiceClient();

  const { error: updateError } = await svc
    .from('fleet_owners')
    .update({
      status: 'suspended',
      suspended_reason: reason,
      admin_notes: `Suspended by ${adminId}: ${reason}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ownerId);

  if (updateError) {
    console.error(LOG_PREFIX, 'Failed to suspend owner', updateError);
    throw new FleetError(FleetErrorCode.DB_ERROR, 'Failed to suspend owner');
  }
}
