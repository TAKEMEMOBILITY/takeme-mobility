// ── Fleet Owner Types ────────────────────────────────────────────────────

export type FleetOwnerStatus = 'started' | 'pending_documents' | 'pending_kyc' | 'pending_contract' | 'pending_vehicle_review' | 'approved' | 'rejected' | 'suspended'
export type KycStatus = 'not_started' | 'pending' | 'verified' | 'rejected' | 'expired'

export interface FleetOwner {
  id: string
  auth_user_id: string
  email: string
  phone: string | null
  business_name: string | null
  business_type: string | null
  tax_id_last4: string | null
  status: FleetOwnerStatus
  risk_score: number
  admin_notes: string | null
  terms_accepted_at: string | null
  terms_version: string | null
  onboarding_step: number
  approved_at: string | null
  approved_by: string | null
  rejected_reason: string | null
  created_at: string
  updated_at: string
}

export interface FleetOwnerProfile {
  id: string
  owner_id: string
  full_name: string
  business_name: string | null
  business_type: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  zip: string | null
  tax_id: string | null
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  stripe_payouts_enabled: boolean
  stripe_details_submitted: boolean
}

export interface FleetOwnerKyc {
  id: string
  owner_id: string
  status: KycStatus
  provider: string
  provider_session_id: string | null
  id_type: string | null
  verified_at: string | null
  rejection_reason: string | null
  expires_at: string | null
}

// ── Vehicle Types ────────────────────────────────────────────────────────

export type VehicleStatus = 'draft' | 'pending_documents' | 'pending_contract_schedule' | 'pending_review' | 'active' | 'inactive' | 'suspended' | 'rejected'

export interface FleetVehicle {
  id: string
  owner_id: string
  vin: string | null
  plate: string | null
  year: number
  make: string
  model: string
  color: string | null
  body_type: string | null
  seating: number
  range_miles: number | null
  charging_type: string | null
  connector_type: string | null
  battery_capacity_kwh: number | null
  performance_category: string
  pickup_address: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  daily_rate_cents: number
  weekly_rate_cents: number | null
  monthly_rate_cents: number | null
  deposit_amount_cents: number
  min_rental_days: number
  min_driver_age: number
  mileage_limit_daily: number | null
  excess_mileage_cents: number
  cleaning_fee_cents: number
  accessories: string[]
  status: VehicleStatus
  admin_notes: string | null
  rejected_reason: string | null
  photos?: VehiclePhoto[]
  created_at: string
  updated_at: string
}

export interface VehiclePhoto {
  id: string
  vehicle_id: string
  photo_type: string
  file_url: string
  sort_order: number
}

// ── Booking Types ────────────────────────────────────────────────────────

export type BookingStatus = 'draft' | 'pending_checkout' | 'deposit_pending' | 'confirmed' | 'pickup_ready' | 'in_use' | 'return_pending' | 'completed' | 'cancelled' | 'failed' | 'disputed'

export interface FleetBooking {
  id: string
  vehicle_id: string
  driver_id: string
  owner_id: string
  status: BookingStatus
  start_date: string
  end_date: string
  daily_rate_cents: number
  total_rental_cents: number
  commission_cents: number
  owner_payout_cents: number
  deposit_amount_cents: number
  surge_multiplier: number
  discount_pct: number
  cleaning_fee_cents: number
  contract_id: string | null
  idempotency_key: string | null
  pickup_address: string | null
  pickup_notes: string | null
  actual_pickup_at: string | null
  actual_return_at: string | null
  odometer_pickup: number | null
  odometer_return: number | null
  excess_miles: number | null
  excess_charge_cents: number
  damage_reported: boolean
  damage_charge_cents: number
  confirmed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
}

// ── Contract Types ───────────────────────────────────────────────────────

export type ContractStatus = 'draft' | 'pending_signature' | 'partially_signed' | 'executed' | 'declined' | 'expired' | 'revoked'

export interface FleetContract {
  id: string
  template_id: string
  type: string
  status: ContractStatus
  owner_id: string | null
  vehicle_id: string | null
  driver_id: string | null
  booking_id: string | null
  rendered_body: string | null
  variables: Record<string, string>
  document_hash: string | null
  version: number
  executed_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

// ── Eligibility Types ────────────────────────────────────────────────────

export type EligibilityResult = 'eligible' | 'eligible_with_conditions' | 'ineligible' | 'manual_review_required'

export interface DriverEligibility {
  id: string
  driver_id: string
  vehicle_id: string
  result: EligibilityResult
  reasons: Array<{ check: string; passed: boolean; detail?: string }>
  checked_at: string
  expires_at: string
}

// ── Payment Types ────────────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded' | 'disputed'
export type PaymentType = 'booking_charge' | 'deposit_hold' | 'deposit_capture' | 'deposit_release' | 'excess_mileage' | 'damage_charge' | 'refund'

export interface FleetPayment {
  id: string
  booking_id: string
  driver_id: string
  idempotency_key: string
  payment_type: PaymentType
  amount_cents: number
  currency: string
  stripe_payment_intent_id: string | null
  status: PaymentStatus
  created_at: string
  updated_at: string
}

// ── Payout Types ─────────────────────────────────────────────────────────

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'held' | 'failed' | 'reversed'

export interface FleetPayout {
  id: string
  owner_id: string
  booking_id: string | null
  status: PayoutStatus
  total_cents: number
  gross_cents: number | null
  takeme_fee_cents: number | null
  net_cents: number | null
  stripe_transfer_id: string | null
  stripe_account_id: string | null
  hold_until: string | null
  released_at: string | null
  line_items: Array<{ booking_id: string; gross: number; fee: number; net: number }>
  created_at: string
  updated_at: string
}

// ── Input Types ──────────────────────────────────────────────────────────

export interface RegisterOwnerInput {
  email?: string
  phone?: string
  fullName: string
  businessName?: string
  businessType?: string
}

export interface CreateVehicleInput {
  make: string
  model: string
  year: number
  vin?: string
  plate?: string
  color?: string
  bodyType?: string
  seating?: number
  rangeMiles?: number
  chargingType?: string
  connectorType?: string
  batteryCapacityKwh?: number
  performanceCategory?: string
  pickupAddress?: string
  pickupInstructions?: string
  dailyRateCents: number
  weeklyRateCents?: number
  monthlyRateCents?: number
  depositAmountCents?: number
  minRentalDays?: number
  minDriverAge?: number
  mileageLimitDaily?: number
  excessMileageCents?: number
  cleaningFeeCents?: number
  accessories?: string[]
  ownerNotes?: string
}

export interface SetPricingInput {
  dailyRateCents: number
  weeklyRateCents?: number
  monthlyRateCents?: number
  depositAmountCents?: number
  mileageLimitDaily?: number
  excessMileageCents?: number
  cleaningFeeCents?: number
}

export interface CreateBookingInput {
  vehicleId: string
  startDate: string
  endDate: string
  pickupAddress?: string
  pickupNotes?: string
}

export interface ConfirmBookingInput {
  paymentMethodId?: string
}

export interface CompleteBookingInput {
  odometerReturn?: number
  returnConditionNotes?: string
  damageReported?: boolean
  damageNotes?: string
  damageChargeCents?: number
}

export interface PricingSnapshot {
  dailyRateCents: number
  weeklyRateCents: number | null
  monthlyRateCents: number | null
  depositCents: number
  cleaningFeeCents: number
  surgeMultiplier: number
  discountPct: number
  durationDays: number
  baseRateCents: number
  totalBaseCents: number
  subtotalCents: number
  commissionCents: number
  ownerPayoutCents: number
  totalChargeCents: number
}
