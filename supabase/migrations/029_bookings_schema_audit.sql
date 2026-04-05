-- ═══════════════════════════════════════════════════════════════════════════
-- Bookings schema audit + full column reconciliation
-- Run in Supabase Dashboard → SQL Editor
--
-- Ensures every column written by app/api/bookings/create/route.ts and
-- app/api/stripe/webhook/route.ts exists on the `bookings` table, even
-- if prior migrations (006_pet_rides.sql in particular) were never run
-- against this database. Fully idempotent — safe to re-run.
--
-- Columns reconciled (owner → migration that originally introduced them):
--   pet_type, pet_size, pet_notes, pet_fee         (006_pet_rides)
--   is_airport_trip, airline, flight_number        (this migration)
--   ride_for, passenger_name, passenger_phone      (this migration)
--   driver_notes, meet_greet, name_sign            (this migration)
--
-- Also re-asserts the vehicle_type CHECK constraint with the full set
-- including 'pet_ride'.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Pet columns (from 006_pet_rides.sql, re-applied in case it never ran) ──
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_type  TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_size  TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_notes TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_fee   NUMERIC(10,2) DEFAULT 0;

-- ── Airport trip columns ───────────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_airport_trip BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS airline         TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_number   TEXT;

-- ── Passenger/rider-for columns ────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ride_for         TEXT DEFAULT 'me';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_name   TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_phone  TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_notes     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meet_greet       BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS name_sign        BOOLEAN DEFAULT FALSE;

-- ── ride_for value constraint (drop-and-recreate so re-runs are safe) ──────
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_ride_for_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_ride_for_check
  CHECK (ride_for IS NULL OR ride_for IN ('me', 'someone', 'vip'));

-- ── vehicle_type constraint (re-assert full set including pet_ride) ────────
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_vehicle_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_vehicle_type_check
  CHECK (vehicle_type IN (
    'electric',
    'comfort_electric',
    'premium_electric',
    'suv_electric',
    'women_rider',
    'pet_ride'
  ));

-- ── Helpful indexes for new query patterns ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_is_airport_trip
  ON bookings(is_airport_trip) WHERE is_airport_trip = TRUE;

-- ── PostgREST schema cache refresh ─────────────────────────────────────────
-- Supabase's API layer caches the schema. Without this NOTIFY, new columns
-- won't be visible to the REST client until the next cache rebuild, which
-- is exactly the failure mode that produced the "Could not find the
-- 'pet_fee' column" error in the first place.
NOTIFY pgrst, 'reload schema';
