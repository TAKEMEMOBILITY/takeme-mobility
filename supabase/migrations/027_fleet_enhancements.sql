-- ═══════════════════════════════════════════════════════════════════════════
-- 027 — TakeMe Fleet Enhancements
-- Adds Stripe Connect fields, payments tracking, booking locks, audit trails
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Additional columns on fleet_owners ──────────────────────────────────

ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS tax_id_last4 text;
ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS risk_score smallint DEFAULT 0;
ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE fleet_owners ADD COLUMN IF NOT EXISTS admin_notes text;

-- ── Additional columns on fleet_owner_profiles (Stripe Connect) ─────────

ALTER TABLE fleet_owner_profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false;
ALTER TABLE fleet_owner_profiles ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean DEFAULT false;
ALTER TABLE fleet_owner_profiles ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean DEFAULT false;

-- ── Additional columns on fleet_owner_kyc (Stripe Identity) ─────────────

ALTER TABLE fleet_owner_kyc ADD COLUMN IF NOT EXISTS provider text DEFAULT 'stripe';
ALTER TABLE fleet_owner_kyc ADD COLUMN IF NOT EXISTS provider_session_id text;

-- ── Additional columns on fleet_vehicles ─────────────────────────────────

ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS battery_capacity_kwh numeric(6,2);
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS connector_type text;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS charge_speed_kw numeric(6,2);
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS base_zip text;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS registration_expires date;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS insurance_provider text;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS insurance_policy_num text;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS insurance_expires date;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS last_inspection_date date;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS odometer_at_listing integer;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS monthly_rate_cents integer;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS mileage_limit_daily integer;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS excess_mileage_cents integer DEFAULT 25;
ALTER TABLE fleet_vehicles ADD COLUMN IF NOT EXISTS cleaning_fee_cents integer DEFAULT 0;

-- ── Additional columns on rental_bookings ────────────────────────────────

ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS surge_multiplier numeric(4,2) DEFAULT 1.00;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS discount_pct smallint DEFAULT 0;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS cleaning_fee_cents integer DEFAULT 0;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS pickup_address text;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS pickup_notes text;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS actual_pickup_at timestamptz;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS actual_return_at timestamptz;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS odometer_pickup integer;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS odometer_return integer;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS excess_miles integer;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS excess_charge_cents integer DEFAULT 0;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS damage_reported boolean DEFAULT false;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS damage_charge_cents integer DEFAULT 0;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- ── Additional columns on fleet_payouts ──────────────────────────────────

ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES rental_bookings(id);
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS gross_cents integer;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS takeme_fee_cents integer;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS net_cents integer;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS stripe_transfer_group text;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS hold_until timestamptz;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS failure_code text;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS failure_message text;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS retry_count smallint DEFAULT 0;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE fleet_payouts ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]';

-- ── Fleet Payments (tracks all Stripe payment intents for fleet) ────────

DO $$ BEGIN CREATE TYPE fleet_payment_status AS ENUM ('pending','processing','succeeded','failed','refunded','partially_refunded','disputed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE fleet_payment_type AS ENUM ('booking_charge','deposit_hold','deposit_capture','deposit_release','excess_mileage','damage_charge','refund'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS fleet_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES rental_bookings(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payment_type fleet_payment_type NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id text UNIQUE,
  stripe_payment_method_id text,
  stripe_charge_id text,
  stripe_refund_id text,
  status fleet_payment_status NOT NULL DEFAULT 'pending',
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  refund_amount_cents integer,
  description text,
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE fleet_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet_fleet_payments_all" ON fleet_payments FOR ALL USING (true) WITH CHECK (true);

-- ── Booking Locks (date-level locking for availability) ─────────────────

CREATE TABLE IF NOT EXISTS fleet_booking_locks (
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  date_key date NOT NULL,
  booking_id uuid REFERENCES rental_bookings(id) ON DELETE CASCADE,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  PRIMARY KEY (vehicle_id, date_key)
);

-- ── Vehicle Audit Trail ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_vehicle_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id) ON DELETE RESTRICT,
  actor_id uuid,
  actor_role text NOT NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Contract Events ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  event text NOT NULL,
  actor_id uuid,
  actor_role text NOT NULL,
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Availability check function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION fleet_check_availability(
  p_vehicle_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_booking_id uuid DEFAULT NULL
) RETURNS boolean AS $$
DECLARE conflict_count integer;
BEGIN
  SELECT COUNT(*) INTO conflict_count FROM rental_bookings
  WHERE vehicle_id = p_vehicle_id
    AND id != COALESCE(p_booking_id, '00000000-0000-0000-0000-000000000000')
    AND status NOT IN ('cancelled','failed')
    AND (start_date, end_date) OVERLAPS (p_starts_at, p_ends_at);
  IF conflict_count > 0 THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO conflict_count FROM vehicle_availability
  WHERE vehicle_id = p_vehicle_id
    AND blocked = true
    AND (available_from, available_until) OVERLAPS (p_starts_at, p_ends_at);
  RETURN conflict_count = 0;
END; $$ LANGUAGE plpgsql;

-- ── Booking status transition trigger ───────────────────────────────────

CREATE OR REPLACE FUNCTION fleet_validate_booking_transition() RETURNS TRIGGER AS $$
DECLARE
  valid_transitions jsonb := '{
    "draft":["pending_checkout","cancelled"],
    "pending_checkout":["deposit_pending","cancelled","failed"],
    "deposit_pending":["confirmed","cancelled","failed"],
    "confirmed":["pickup_ready","cancelled"],
    "pickup_ready":["in_use","cancelled"],
    "in_use":["return_pending","completed","disputed"],
    "return_pending":["completed","disputed"],
    "completed":[],
    "cancelled":[],
    "failed":[],
    "disputed":["completed","cancelled"]
  }';
  allowed_next text[];
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  SELECT ARRAY(SELECT jsonb_array_elements_text(valid_transitions->OLD.status::text)) INTO allowed_next;
  IF NOT (NEW.status::text = ANY(allowed_next)) THEN
    RAISE EXCEPTION 'Invalid booking status transition: % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN NEW.confirmed_at = now(); END IF;
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN NEW.completed_at = now(); END IF;
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN NEW.cancelled_at = now(); END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fleet_booking_status_transition ON rental_bookings;
CREATE TRIGGER fleet_booking_status_transition
  BEFORE UPDATE OF status ON rental_bookings
  FOR EACH ROW EXECUTE FUNCTION fleet_validate_booking_transition();

-- ── Updated_at triggers for new tables ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fleet_payments_updated_at ON fleet_payments;
CREATE TRIGGER fleet_payments_updated_at BEFORE UPDATE ON fleet_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Storage bucket for vehicle photos ───────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fleet-vehicle-photos', 'fleet-vehicle-photos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ── Marketplace view ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW fleet_marketplace_listings AS
SELECT
  v.id AS vehicle_id, v.owner_id, v.year, v.make, v.model, v.color,
  v.body_type AS vehicle_type, v.range_miles, v.connector_type,
  v.pickup_address AS base_address, v.pickup_lat, v.pickup_lng,
  v.daily_rate_cents, v.weekly_rate_cents, v.monthly_rate_cents,
  v.deposit_amount_cents AS deposit_cents,
  v.daily_rate_cents AS effective_daily_rate_cents
FROM fleet_vehicles v
WHERE v.status = 'active';
