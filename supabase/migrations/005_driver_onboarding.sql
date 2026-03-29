-- ═══════════════════════════════════════════════════════════════════════════
-- Driver onboarding + bookings extensions
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Driver applications table ────────────────────────────────────────────
-- Captures onboarding data before driver is verified and activated.

CREATE TABLE IF NOT EXISTS driver_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT,
  license_number  TEXT NOT NULL,
  vehicle_make    TEXT NOT NULL,
  vehicle_model   TEXT NOT NULL,
  vehicle_year    INTEGER,
  vehicle_color   TEXT,
  plate_number    TEXT NOT NULL,
  vehicle_class   TEXT NOT NULL DEFAULT 'electric'
                  CHECK (vehicle_class IN ('electric', 'comfort_electric', 'premium_electric', 'suv_electric')),
  city            TEXT DEFAULT 'Seattle',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_apps_user ON driver_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_apps_status ON driver_applications(status);

ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_apps_select_own" ON driver_applications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "driver_apps_insert_own" ON driver_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Extend bookings for airport + VIP ────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ride_for TEXT DEFAULT 'me';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_name TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_phone TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_notes TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meet_greet BOOLEAN DEFAULT FALSE;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS name_sign BOOLEAN DEFAULT FALSE;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS airline TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_number TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_airport_trip BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── Driver subscriptions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id             UUID NOT NULL,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                  TEXT NOT NULL DEFAULT 'connect' CHECK (plan IN ('connect')),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  price_monthly         NUMERIC(10,2) NOT NULL DEFAULT 29.90,
  currency              TEXT DEFAULT 'USD',
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_subs_user ON driver_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_subs_status ON driver_subscriptions(status);

ALTER TABLE driver_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_subs_select_own" ON driver_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
