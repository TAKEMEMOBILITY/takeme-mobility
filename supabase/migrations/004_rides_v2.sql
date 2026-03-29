-- ═══════════════════════════════════════════════════════════════════════════
-- Rides v2 — simplified table for Seattle launch
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Locations
  pickup_address      TEXT NOT NULL,
  pickup_lat          NUMERIC(10,7) NOT NULL,
  pickup_lng          NUMERIC(10,7) NOT NULL,
  destination_address TEXT NOT NULL,
  destination_lat     NUMERIC(10,7) NOT NULL,
  destination_lng     NUMERIC(10,7) NOT NULL,

  -- Route
  distance_miles      NUMERIC(8,2) NOT NULL,
  duration_minutes    INTEGER NOT NULL,

  -- Ride
  vehicle_type        TEXT NOT NULL CHECK (vehicle_type IN ('economy', 'comfort', 'premium')),
  price               NUMERIC(10,2) NOT NULL,
  currency            TEXT DEFAULT 'USD',

  -- Status
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),

  -- Stripe
  stripe_session_id   TEXT,
  stripe_payment_id   TEXT,

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookings_insert_own" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings_update_own" ON bookings
  FOR UPDATE USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER trg_bookings_updated
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
