import { createServiceClient } from '@/lib/supabase/service';

// ═══════════════════════════════════════════════════════════════════════════
// Driver Rental Eligibility Engine
// Checks: license, age, score, incidents, payment, deposit, agreement, geo
// ═══════════════════════════════════════════════════════════════════════════

type EligibilityResult = 'eligible' | 'eligible_with_conditions' | 'ineligible' | 'manual_review_required';

interface EligibilityCheck {
  check: string;
  passed: boolean;
  reason: string;
}

interface EligibilityOutcome {
  result: EligibilityResult;
  checks: EligibilityCheck[];
  missingRequirements: string[];
  depositRequired: boolean;
  manualReviewNeeded: boolean;
}

export async function checkDriverEligibility(
  driverId: string,
  vehicleId: string,
): Promise<EligibilityOutcome> {
  const svc = createServiceClient();
  const checks: EligibilityCheck[] = [];
  const missing: string[] = [];

  // Get driver rental profile
  const { data: profile } = await svc
    .from('driver_rental_profiles')
    .select('*')
    .eq('driver_id', driverId)
    .single();

  // Get vehicle requirements
  const { data: vehicle } = await svc
    .from('fleet_vehicles')
    .select('min_driver_age, min_driver_score, deposit_amount_cents, status')
    .eq('id', vehicleId)
    .single();

  if (!vehicle || vehicle.status !== 'active') {
    return { result: 'ineligible', checks: [{ check: 'vehicle_active', passed: false, reason: 'Vehicle not available' }], missingRequirements: ['Vehicle not active'], depositRequired: false, manualReviewNeeded: false };
  }

  if (!profile) {
    return { result: 'ineligible', checks: [{ check: 'rental_profile', passed: false, reason: 'No rental profile' }], missingRequirements: ['Complete rental profile'], depositRequired: false, manualReviewNeeded: false };
  }

  // License verified
  const licenseOk = profile.license_verified === true;
  checks.push({ check: 'license_verified', passed: licenseOk, reason: licenseOk ? 'License verified' : 'License not verified' });
  if (!licenseOk) missing.push('Verify driver license');

  // Age
  const minAge = vehicle.min_driver_age ?? 21;
  const ageOk = (profile.age ?? 0) >= minAge;
  checks.push({ check: 'age_threshold', passed: ageOk, reason: ageOk ? `Age ${profile.age} >= ${minAge}` : `Must be ${minAge}+` });
  if (!ageOk) missing.push(`Minimum age: ${minAge}`);

  // Driver score
  const minScore = vehicle.min_driver_score ? Number(vehicle.min_driver_score) : 4.0;
  const scoreOk = (Number(profile.driver_score) || 0) >= minScore;
  checks.push({ check: 'driver_score', passed: scoreOk, reason: scoreOk ? `Score ${profile.driver_score} >= ${minScore}` : `Minimum score: ${minScore}` });
  if (!scoreOk) missing.push(`Minimum driver score: ${minScore}`);

  // Incidents
  const incidentsOk = (profile.incidents_count ?? 0) <= 2;
  checks.push({ check: 'incident_history', passed: incidentsOk, reason: incidentsOk ? 'Acceptable incident history' : 'Too many incidents' });

  // Payment method
  const paymentOk = profile.payment_method_on_file === true;
  checks.push({ check: 'payment_method', passed: paymentOk, reason: paymentOk ? 'Payment method on file' : 'No payment method' });
  if (!paymentOk) missing.push('Add payment method');

  // Deposit capability
  const depositRequired = (vehicle.deposit_amount_cents ?? 0) > 0;
  const depositOk = !depositRequired || profile.deposit_capable === true;
  checks.push({ check: 'deposit_capable', passed: depositOk, reason: depositOk ? 'Deposit capability confirmed' : 'Cannot process deposit' });
  if (!depositOk) missing.push('Enable deposit capability');

  // Rental agreement
  const agreementOk = profile.rental_agreement_accepted === true;
  checks.push({ check: 'rental_agreement', passed: agreementOk, reason: agreementOk ? 'Agreement accepted' : 'Agreement not accepted' });
  if (!agreementOk) missing.push('Accept rental agreement');

  // Determine result
  const allPassed = checks.every(c => c.passed);
  const criticalFailed = checks.filter(c => !c.passed && ['license_verified', 'age_threshold', 'payment_method'].includes(c.check)).length > 0;
  const manualReviewNeeded = !incidentsOk || (!scoreOk && (Number(profile.driver_score) || 0) >= minScore - 0.5);

  let result: EligibilityResult;
  if (allPassed) result = 'eligible';
  else if (criticalFailed) result = 'ineligible';
  else if (manualReviewNeeded) result = 'manual_review_required';
  else result = 'eligible_with_conditions';

  // Cache result
  await svc.from('driver_rental_eligibility').insert({
    driver_id: driverId,
    vehicle_id: vehicleId,
    result,
    reasons: checks,
  });

  return { result, checks, missingRequirements: missing, depositRequired, manualReviewNeeded };
}
