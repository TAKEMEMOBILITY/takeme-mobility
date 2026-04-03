-- ═══════════════════════════════════════════════════════════════════════════
-- 026 — TakeMe Fleet System
-- EV owner onboarding, vehicle listing, contracts, rentals, payouts
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE fleet_owner_status AS ENUM ('started','pending_documents','pending_kyc','pending_contract','pending_vehicle_review','approved','rejected','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE fleet_kyc_status AS ENUM ('not_started','pending','verified','rejected','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE vehicle_status AS ENUM ('draft','pending_documents','pending_contract_schedule','pending_review','active','inactive','suspended','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE contract_status AS ENUM ('draft','pending_signature','partially_signed','executed','declined','expired','revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE contract_type AS ENUM ('master_agreement','vehicle_schedule','driver_rental_agreement'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE signature_event_type AS ENUM ('viewed','consented','signed','declined','expired','webhook_confirmed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE booking_status AS ENUM ('draft','pending_checkout','deposit_pending','confirmed','pickup_ready','in_use','return_pending','completed','cancelled','failed','disputed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deposit_status AS ENUM ('not_required','pending','authorized','captured','released','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payout_status AS ENUM ('pending','processing','paid','held','failed','reversed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE eligibility_result AS ENUM ('eligible','eligible_with_conditions','ineligible','manual_review_required'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE handoff_type AS ENUM ('pickup','return'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Fleet Owners ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  phone text,
  status fleet_owner_status NOT NULL DEFAULT 'started',
  onboarding_step int DEFAULT 1,
  approved_at timestamptz,
  approved_by uuid,
  rejected_reason text,
  suspended_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fleet_owner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES fleet_owners(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  business_name text,
  business_type text, -- individual / llc / corp
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  tax_id text,
  stripe_account_id text, -- connected account for payouts
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fleet_owner_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES fleet_owners(id) ON DELETE CASCADE,
  status fleet_kyc_status NOT NULL DEFAULT 'not_started',
  id_type text, -- drivers_license / passport / state_id
  id_number_hash text, -- never store plaintext
  id_front_url text,
  id_back_url text,
  selfie_url text,
  verified_at timestamptz,
  verified_by uuid,
  rejection_reason text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── Vehicles ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES fleet_owners(id) ON DELETE CASCADE,
  status vehicle_status NOT NULL DEFAULT 'draft',
  vin text UNIQUE,
  plate text,
  make text NOT NULL,
  model text NOT NULL,
  year int NOT NULL,
  color text,
  body_type text, -- sedan / suv / hatchback / truck
  seating int DEFAULT 5,
  range_miles int,
  charging_type text, -- level1 / level2 / dc_fast
  performance_category text, -- standard / premium / luxury
  pickup_address text,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  pickup_instructions text,
  daily_rate_cents int NOT NULL,
  weekly_rate_cents int,
  deposit_amount_cents int DEFAULT 0,
  min_rental_days int DEFAULT 1,
  min_driver_age int DEFAULT 21,
  min_driver_score numeric(3,2),
  accessories text[], -- e.g. '{dashcam,phone_mount,usb_cable}'
  owner_notes text,
  admin_notes text,
  approved_at timestamptz,
  approved_by uuid,
  rejected_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_owner ON fleet_vehicles (owner_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_status ON fleet_vehicles (status);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_active ON fleet_vehicles (status, daily_rate_cents) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  doc_type text NOT NULL, -- registration / title / inspection
  file_url text NOT NULL,
  verified bool DEFAULT false,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  photo_type text NOT NULL, -- front / rear / left / right / interior / dashboard
  file_url text NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES fleet_owners(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES fleet_vehicles(id),
  provider text NOT NULL,
  policy_number text NOT NULL,
  coverage_type text, -- liability / comprehensive / rideshare
  file_url text,
  effective_date date NOT NULL,
  expiry_date date NOT NULL,
  verified bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ownership_verification_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES fleet_owners(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES fleet_vehicles(id),
  doc_type text NOT NULL, -- title / registration / bill_of_sale
  file_url text NOT NULL,
  verified bool DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  available_from timestamptz NOT NULL,
  available_until timestamptz NOT NULL,
  blocked bool DEFAULT false,
  block_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  rule_type text NOT NULL, -- weekly_discount / monthly_discount / surge / holiday
  modifier_pct numeric(5,2), -- e.g. -10 for 10% off, +20 for 20% surge
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ── Contracts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type contract_type NOT NULL,
  name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  body_template text NOT NULL, -- template with {{variable}} placeholders
  variables jsonb DEFAULT '[]', -- list of variable definitions
  active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES contract_templates(id),
  type contract_type NOT NULL,
  status contract_status NOT NULL DEFAULT 'draft',
  owner_id uuid REFERENCES fleet_owners(id),
  vehicle_id uuid REFERENCES fleet_vehicles(id),
  driver_id uuid,
  booking_id uuid,
  rendered_body text, -- template with variables filled in
  variables jsonb DEFAULT '{}', -- actual variable values used
  document_hash text, -- SHA-256 of rendered_body
  signed_document_url text,
  version int DEFAULT 1,
  executed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_owner ON contracts (owner_id, type);
CREATE INDEX IF NOT EXISTS idx_contracts_vehicle ON contracts (vehicle_id, type);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts (status);

CREATE TABLE IF NOT EXISTS contract_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_role text NOT NULL, -- owner / driver / platform
  signer_user_id uuid,
  signer_email text NOT NULL,
  signer_name text,
  signed bool DEFAULT false,
  signed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_id uuid REFERENCES contract_signers(id),
  event_type signature_event_type NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  action text NOT NULL,
  actor_id uuid,
  actor_email text,
  previous_status contract_status,
  new_status contract_status,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
REVOKE UPDATE, DELETE ON contract_audit_events FROM authenticated;
REVOKE UPDATE, DELETE ON contract_audit_events FROM anon;

-- ── Driver Rental ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_rental_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL UNIQUE,
  license_verified bool DEFAULT false,
  age int,
  driver_score numeric(3,2),
  incidents_count int DEFAULT 0,
  payment_method_on_file bool DEFAULT false,
  deposit_capable bool DEFAULT false,
  rental_agreement_accepted bool DEFAULT false,
  rental_agreement_accepted_at timestamptz,
  geographic_region text DEFAULT 'seattle',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_rental_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id),
  result eligibility_result NOT NULL,
  reasons jsonb DEFAULT '[]', -- list of pass/fail reasons
  checked_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '1 hour'
);
CREATE INDEX IF NOT EXISTS idx_eligibility_driver_vehicle ON driver_rental_eligibility (driver_id, vehicle_id);

-- ── Bookings ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id),
  driver_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES fleet_owners(id),
  status booking_status NOT NULL DEFAULT 'draft',
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  daily_rate_cents int NOT NULL,
  total_rental_cents int NOT NULL,
  commission_cents int NOT NULL, -- 20%
  owner_payout_cents int NOT NULL, -- 80%
  deposit_amount_cents int DEFAULT 0,
  contract_id uuid REFERENCES contracts(id),
  checkout_session_id uuid,
  idempotency_key text UNIQUE,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON rental_bookings (vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON rental_bookings (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON rental_bookings (vehicle_id, start_date, end_date) WHERE status NOT IN ('cancelled','failed');

CREATE TABLE IF NOT EXISTS rental_booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES rental_bookings(id),
  previous_status booking_status,
  new_status booking_status NOT NULL,
  changed_by uuid,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rental_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES rental_bookings(id),
  stripe_session_id text,
  stripe_payment_intent_id text,
  amount_cents int NOT NULL,
  status text DEFAULT 'pending', -- pending / completed / failed / expired
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 minutes'
);

CREATE TABLE IF NOT EXISTS security_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES rental_bookings(id),
  amount_cents int NOT NULL,
  status deposit_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id text,
  authorized_at timestamptz,
  captured_at timestamptz,
  released_at timestamptz,
  capture_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── Handoffs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES rental_bookings(id),
  handoff_type handoff_type NOT NULL,
  timestamp timestamptz DEFAULT now(),
  battery_pct int,
  odometer int,
  exterior_condition text, -- good / fair / damaged
  interior_condition text,
  accessories_present text[],
  photos jsonb DEFAULT '[]', -- array of photo URLs
  notes text,
  confirmed_by_driver bool DEFAULT false,
  confirmed_by_platform bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_return_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES rental_bookings(id),
  cleanliness text, -- clean / acceptable / dirty
  damage_found bool DEFAULT false,
  charge_level_ok bool DEFAULT true,
  late_return bool DEFAULT false,
  late_minutes int DEFAULT 0,
  cleaning_fee_cents int DEFAULT 0,
  late_fee_cents int DEFAULT 0,
  damage_fee_cents int DEFAULT 0,
  total_extra_fees_cents int DEFAULT 0,
  notes text,
  reviewed_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS damage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES rental_bookings(id),
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id),
  reported_by uuid,
  description text NOT NULL,
  severity text NOT NULL, -- minor / moderate / major
  photos jsonb DEFAULT '[]',
  estimated_repair_cents int,
  resolved bool DEFAULT false,
  resolution text,
  created_at timestamptz DEFAULT now()
);

-- ── Financial ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES rental_bookings(id) UNIQUE,
  gross_amount_cents int NOT NULL,
  commission_rate numeric(5,4) NOT NULL DEFAULT 0.20,
  commission_cents int NOT NULL,
  owner_net_cents int NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fleet_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES fleet_owners(id),
  status payout_status NOT NULL DEFAULT 'pending',
  total_cents int NOT NULL,
  stripe_transfer_id text,
  period_start date,
  period_end date,
  held_reason text,
  held_by uuid,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES fleet_payouts(id),
  booking_id uuid NOT NULL REFERENCES rental_bookings(id),
  gross_cents int NOT NULL,
  commission_cents int NOT NULL,
  net_cents int NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- ── Risk / Monitoring ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL, -- low / medium / high / critical
  entity_type text, -- owner / vehicle / booking / payout
  entity_id uuid,
  description text,
  auto_action text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fleet_invariant_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invariant text NOT NULL,
  priority text NOT NULL,
  violation text NOT NULL,
  context jsonb DEFAULT '{}',
  auto_resolved bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);
REVOKE UPDATE, DELETE ON fleet_invariant_violations FROM authenticated;
REVOKE UPDATE, DELETE ON fleet_invariant_violations FROM anon;

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE fleet_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_owner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_owner_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership_verification_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signature_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_invariant_violations ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (all tables)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'fleet_owners','fleet_owner_profiles','fleet_owner_kyc','fleet_vehicles',
    'vehicle_documents','vehicle_photos','insurance_policies','ownership_verification_docs',
    'vehicle_availability','vehicle_pricing_rules','contract_templates','contracts',
    'contract_signers','contract_signature_events','contract_audit_events',
    'driver_rental_profiles','driver_rental_eligibility','rental_bookings',
    'rental_booking_status_history','rental_checkout_sessions','security_deposits',
    'vehicle_handoffs','vehicle_return_reports','damage_reports',
    'fleet_commissions','fleet_payouts','payout_line_items',
    'fleet_risk_events','fleet_invariant_violations'
  ]) LOOP
    EXECUTE format('CREATE POLICY "fleet_%s_all" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Seed contract templates ──────────────────────────────────────────────

INSERT INTO contract_templates (type, name, version, body_template, variables) VALUES
('master_agreement', 'Fleet Partner Master Agreement', 1,
'FLEET PARTNER MASTER AGREEMENT

This Fleet Partner Master Agreement ("Agreement") is entered into between TakeMe Mobility Inc. ("Platform") and {{owner_name}} ("Fleet Partner") as of {{effective_date}}.

1. LISTING RIGHTS
Fleet Partner grants Platform the non-exclusive right to list approved vehicles on the TakeMe marketplace for rental by qualified drivers.

2. PLATFORM COMMISSION
Platform retains {{commission_rate}}% of gross rental revenue. Net proceeds are paid to Fleet Partner per the payout schedule.

3. PAYOUT TERMS
Payouts are processed weekly for completed, undisputed rentals. Platform reserves the right to hold payouts for disputed bookings.

4. OWNER RESPONSIBILITIES
Fleet Partner shall maintain vehicles in safe, roadworthy condition; maintain valid insurance; respond to damage reports within 48 hours; keep vehicle documentation current.

5. MAINTENANCE
Fleet Partner is responsible for all vehicle maintenance, repairs, and upkeep. Platform may suspend vehicles that fail safety standards.

6. INSURANCE
Fleet Partner must maintain comprehensive insurance with minimum $100,000 liability coverage per vehicle. Proof of insurance must be uploaded and kept current.

7. DISPUTE HANDLING
Disputes are reviewed by Platform within 5 business days. Platform decision is binding for amounts under $500.

8. DEACTIVATION
Platform may deactivate vehicles or suspend Fleet Partner for: safety violations, insurance lapse, fraud, repeated disputes, or breach of this Agreement.

9. FRAUD / ABUSE
Any fraudulent activity results in immediate suspension, payout hold, and potential legal action.

10. ELECTRONIC RECORDS
Both parties consent to electronic signatures and records under the ESIGN Act and UETA.

FLEET PARTNER: {{owner_name}}
DATE: {{signature_date}}',
'[{"name":"owner_name","type":"text"},{"name":"effective_date","type":"date"},{"name":"commission_rate","type":"number","default":20},{"name":"signature_date","type":"date"}]'
),
('vehicle_schedule', 'Vehicle Listing Schedule', 1,
'VEHICLE LISTING SCHEDULE

Addendum to Fleet Partner Master Agreement

Vehicle: {{year}} {{make}} {{model}}
VIN: {{vin}}
Plate: {{plate}}
Color: {{color}}

Daily Rate: ${{daily_rate}}
Weekly Rate: ${{weekly_rate}}
Security Deposit: ${{deposit_amount}}

Pickup Location: {{pickup_address}}
Minimum Rental: {{min_days}} days
Minimum Driver Age: {{min_age}}

Charging: {{charging_type}}
Accessories: {{accessories}}

Owner-specific constraints: {{owner_notes}}

Effective Date: {{effective_date}}

FLEET PARTNER: {{owner_name}}
DATE: {{signature_date}}',
'[{"name":"year","type":"number"},{"name":"make","type":"text"},{"name":"model","type":"text"},{"name":"vin","type":"text"},{"name":"plate","type":"text"},{"name":"color","type":"text"},{"name":"daily_rate","type":"text"},{"name":"weekly_rate","type":"text"},{"name":"deposit_amount","type":"text"},{"name":"pickup_address","type":"text"},{"name":"min_days","type":"number"},{"name":"min_age","type":"number"},{"name":"charging_type","type":"text"},{"name":"accessories","type":"text"},{"name":"owner_notes","type":"text"},{"name":"effective_date","type":"date"},{"name":"owner_name","type":"text"},{"name":"signature_date","type":"date"}]'
),
('driver_rental_agreement', 'Driver Rental Agreement', 1,
'DRIVER RENTAL AGREEMENT

This agreement governs your rental of {{year}} {{make}} {{model}} ({{plate}}) from {{start_date}} to {{end_date}}.

1. PERMITTED USE: Personal transportation and TakeMe ride-hailing only.
2. PROHIBITED USE: Racing, off-road, towing, subletting, illegal activity.
3. RETURN: Vehicle must be returned to pickup location with minimum {{min_charge}}% battery.
4. MILEAGE: Unlimited within {{region}}.
5. CONDITION: No smoking. No pets unless pre-approved. Cleaning fee of $75 for excessive mess.
6. LATE RETURN: ${{late_fee_per_hour}}/hour after scheduled return time.
7. DAMAGE: Report immediately. Driver is responsible for unreported damage up to deposit amount.
8. DEPOSIT: ${{deposit_amount}} held until return inspection complete.
9. TERMINATION: Platform may terminate rental for violations. Driver forfeits deposit for serious violations.

DRIVER: {{driver_name}}
DATE: {{signature_date}}',
'[{"name":"year","type":"number"},{"name":"make","type":"text"},{"name":"model","type":"text"},{"name":"plate","type":"text"},{"name":"start_date","type":"date"},{"name":"end_date","type":"date"},{"name":"min_charge","type":"number","default":20},{"name":"region","type":"text","default":"Seattle metro"},{"name":"late_fee_per_hour","type":"number","default":25},{"name":"deposit_amount","type":"text"},{"name":"driver_name","type":"text"},{"name":"signature_date","type":"date"}]'
)
ON CONFLICT DO NOTHING;
