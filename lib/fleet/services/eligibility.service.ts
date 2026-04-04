import { createServiceClient } from '@/lib/supabase/service'
import { FleetError, FleetErrorCode } from '@/lib/fleet/errors'

interface EligibilityCheck {
  check: string
  passed: boolean
  detail: string
}

type EligibilityResult =
  | 'eligible'
  | 'eligible_with_conditions'
  | 'ineligible'
  | 'manual_review_required'

export async function checkEligibility(driverId: string, vehicleId: string) {
  const svc = createServiceClient()

  // Fetch vehicle
  const { data: vehicle, error: vehicleErr } = await svc
    .from('fleet_vehicles')
    .select('id, min_driver_age, min_driver_score')
    .eq('id', vehicleId)
    .single()

  if (vehicleErr || !vehicle) {
    throw new FleetError(FleetErrorCode.NOT_FOUND, `Vehicle ${vehicleId} not found`)
  }

  // Fetch or create driver rental profile
  let { data: profile, error: profileErr } = await svc
    .from('driver_rental_profiles')
    .select('*')
    .eq('driver_id', driverId)
    .single()

  if (profileErr || !profile) {
    // Create default profile and return ineligible
    const { data: newProfile, error: createErr } = await svc
      .from('driver_rental_profiles')
      .insert({
        driver_id: driverId,
        license_verified: false,
        age: 0,
        driver_score: 0,
        incidents_count: 0,
        payment_method_on_file: false,
        deposit_capable: false,
        rental_agreement_accepted: false,
      })
      .select('*')
      .single()

    if (createErr || !newProfile) {
      throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to create driver rental profile: ${createErr?.message}`)
    }

    profile = newProfile

    const reasons: EligibilityCheck[] = [
      { check: 'license_verified', passed: false, detail: 'Driver license is not verified' },
      { check: 'min_age', passed: false, detail: 'Driver age not on file' },
      { check: 'driver_score', passed: false, detail: 'Driver score not available' },
      { check: 'incidents_count', passed: false, detail: 'Incident history not available' },
      { check: 'payment_method_on_file', passed: false, detail: 'No payment method on file' },
      { check: 'deposit_capable', passed: false, detail: 'Driver is not deposit capable' },
      { check: 'rental_agreement_accepted', passed: false, detail: 'Rental agreement not accepted' },
    ]

    const { data: record, error: insertErr } = await svc
      .from('driver_rental_eligibility')
      .insert({
        driver_id: driverId,
        vehicle_id: vehicleId,
        result: 'ineligible' as EligibilityResult,
        reasons,
        checked_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (insertErr || !record) {
      throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to save eligibility record: ${insertErr?.message}`)
    }

    return record
  }

  // Run eligibility checks
  const minAge = vehicle.min_driver_age ?? 21
  const minScore = vehicle.min_driver_score ?? 4.0

  const reasons: EligibilityCheck[] = [
    {
      check: 'license_verified',
      passed: profile.license_verified === true,
      detail: profile.license_verified ? 'License is verified' : 'Driver license is not verified',
    },
    {
      check: 'min_age',
      passed: (profile.age ?? 0) >= minAge,
      detail:
        (profile.age ?? 0) >= minAge
          ? `Driver age ${profile.age} meets minimum ${minAge}`
          : `Driver age ${profile.age} is below minimum ${minAge}`,
    },
    {
      check: 'driver_score',
      passed: (profile.driver_score ?? 0) >= minScore,
      detail:
        (profile.driver_score ?? 0) >= minScore
          ? `Driver score ${profile.driver_score} meets minimum ${minScore}`
          : `Driver score ${profile.driver_score} is below minimum ${minScore}`,
    },
    {
      check: 'incidents_count',
      passed: (profile.incidents_count ?? 0) <= 2,
      detail:
        (profile.incidents_count ?? 0) <= 2
          ? `Incidents count ${profile.incidents_count} is within acceptable range`
          : `Incidents count ${profile.incidents_count} exceeds maximum of 2`,
    },
    {
      check: 'payment_method_on_file',
      passed: profile.payment_method_on_file === true,
      detail: profile.payment_method_on_file ? 'Payment method is on file' : 'No payment method on file',
    },
    {
      check: 'deposit_capable',
      passed: profile.deposit_capable === true,
      detail: profile.deposit_capable ? 'Driver is deposit capable' : 'Driver is not deposit capable',
    },
    {
      check: 'rental_agreement_accepted',
      passed: profile.rental_agreement_accepted === true,
      detail: profile.rental_agreement_accepted
        ? 'Rental agreement has been accepted'
        : 'Rental agreement not accepted',
    },
  ]

  const allPassed = reasons.every((r) => r.passed)
  const result: EligibilityResult = allPassed ? 'eligible' : 'ineligible'

  const { data: record, error: insertErr } = await svc
    .from('driver_rental_eligibility')
    .insert({
      driver_id: driverId,
      vehicle_id: vehicleId,
      result,
      reasons,
      checked_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (insertErr || !record) {
    throw new FleetError(FleetErrorCode.DB_ERROR, `Failed to save eligibility record: ${insertErr?.message}`)
  }

  return record
}

export async function getCachedEligibility(driverId: string, vehicleId: string) {
  const svc = createServiceClient()

  const { data, error } = await svc
    .from('driver_rental_eligibility')
    .select('*')
    .eq('driver_id', driverId)
    .eq('vehicle_id', vehicleId)
    .gt('expires_at', new Date().toISOString())
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[EligibilityService] Failed to fetch cached eligibility:', error.message)
    return null
  }

  return data ?? null
}
