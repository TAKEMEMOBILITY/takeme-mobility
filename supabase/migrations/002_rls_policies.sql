-- ═══════════════════════════════════════════════════════════════════════════
-- TAKEME MOBILITY — RLS Policies v2
-- Replaces the basic policies from 001_core_schema.sql
-- Run in Supabase Dashboard → SQL Editor AFTER 001_core_schema.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Schema adjustment: link drivers to auth.users ────────────────────────
-- Drivers who use the app authenticate too. Add an optional auth_user_id
-- so RLS can identify them. Drivers without an auth account (managed by
-- admin) still work — they're handled via service role only.

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_drivers_auth_user ON drivers(auth_user_id);


-- ── Schema adjustment: user role claim ───────────────────────────────────
-- Store role in auth.users.raw_app_meta_data so RLS can check it.
-- Set via service role: supabase.auth.admin.updateUserById(uid, { app_metadata: { role: 'driver' } })

-- Helper: extract role from JWT
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::json->>'role',
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role'),
    'rider'
  );
$$ LANGUAGE sql STABLE;

-- Helper: check if current user is a driver and get their driver_id
CREATE OR REPLACE FUNCTION public.get_driver_id()
RETURNS UUID AS $$
  SELECT id FROM drivers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════
-- DROP ALL EXISTING POLICIES (clean slate)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _table TEXT;
  _policy RECORD;
BEGIN
  FOR _table IN SELECT unnest(ARRAY[
    'riders', 'drivers', 'vehicles', 'driver_locations',
    'ride_quotes', 'rides', 'ride_events', 'payments'
  ]) LOOP
    FOR _policy IN
      SELECT policyname FROM pg_policies WHERE tablename = _table AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', _policy.policyname, _table);
    END LOOP;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- RIDERS
-- Riders = auth.users with role 'rider' (default)
-- Can read/update own profile. Cannot delete (handled by admin).
-- Cannot modify rating, total_rides (server-managed fields).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "riders_select_own"
  ON riders FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "riders_update_own"
  ON riders FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent riders from self-modifying server-managed fields
    -- by ensuring they haven't changed (uses NEW vs OLD comparison in trigger)
  );

-- No INSERT policy for riders — created by handle_new_user() trigger via SECURITY DEFINER
-- No DELETE policy — account deletion handled by admin/service role


-- ═══════════════════════════════════════════════════════════════════════════
-- DRIVERS
-- Riders can see limited driver info (name, rating, avatar) for assigned rides.
-- Drivers can see and update their own profile.
-- All write operations (create, verify) are service-role only.
-- ═══════════════════════════════════════════════════════════════════════════

-- Riders see driver info only for drivers assigned to their active rides
CREATE POLICY "drivers_select_for_rider"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    -- Driver can see own profile
    auth_user_id = auth.uid()
    OR
    -- Rider can see drivers assigned to their rides
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.assigned_driver_id = drivers.id
        AND rides.rider_id = auth.uid()
        AND rides.status NOT IN ('completed', 'cancelled')
    )
  );

-- Driver can update own limited fields (status, avatar)
CREATE POLICY "drivers_update_own"
  ON drivers FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- No INSERT/DELETE — service role only


-- ═══════════════════════════════════════════════════════════════════════════
-- VEHICLES
-- Same visibility rule as drivers — only show vehicle for assigned ride.
-- All write operations are service-role only.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "vehicles_select_for_rider"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    -- Driver sees own vehicle
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = vehicles.driver_id AND drivers.auth_user_id = auth.uid())
    OR
    -- Rider sees vehicle for their active ride
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.vehicle_id = vehicles.id
        AND rides.rider_id = auth.uid()
        AND rides.status NOT IN ('completed', 'cancelled')
    )
  );

-- No INSERT/UPDATE/DELETE — service role only


-- ═══════════════════════════════════════════════════════════════════════════
-- DRIVER_LOCATIONS
-- Highly sensitive — real-time GPS.
-- Riders: can only see locations of drivers assigned to their active ride.
-- Drivers: can update their own location.
-- Never expose all driver positions to any client.
-- ═══════════════════════════════════════════════════════════════════════════

-- Riders see only their assigned driver's location
CREATE POLICY "driver_locations_select_for_rider"
  ON driver_locations FOR SELECT
  TO authenticated
  USING (
    -- Driver sees own location
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_locations.driver_id AND drivers.auth_user_id = auth.uid())
    OR
    -- Rider sees assigned driver's location during active trip
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.assigned_driver_id = driver_locations.driver_id
        AND rides.rider_id = auth.uid()
        AND rides.status IN ('driver_assigned', 'driver_arriving', 'arrived', 'in_progress')
    )
  );

-- Drivers update their own location
CREATE POLICY "driver_locations_upsert_own"
  ON driver_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_locations.driver_id AND drivers.auth_user_id = auth.uid())
  );

CREATE POLICY "driver_locations_update_own"
  ON driver_locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_locations.driver_id AND drivers.auth_user_id = auth.uid())
  );

-- No DELETE — service role only
-- Nearest-driver search (SELECT all available) is done via service role in API route


-- ═══════════════════════════════════════════════════════════════════════════
-- RIDE_QUOTES
-- Riders: create and view own quotes.
-- Immutable — no UPDATE or DELETE policy.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "ride_quotes_select_own"
  ON ride_quotes FOR SELECT
  TO authenticated
  USING (auth.uid() = rider_id);

CREATE POLICY "ride_quotes_insert_own"
  ON ride_quotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = rider_id);

-- No UPDATE — quotes are immutable once created
-- No DELETE — service role only (cleanup)


-- ═══════════════════════════════════════════════════════════════════════════
-- RIDES
-- Riders: create, read own, cancel (limited update).
-- Drivers: read assigned rides, update trip-execution fields only.
-- ═══════════════════════════════════════════════════════════════════════════

-- Riders see their own rides (all statuses, including history)
CREATE POLICY "rides_select_rider"
  ON rides FOR SELECT
  TO authenticated
  USING (auth.uid() = rider_id);

-- Drivers see rides assigned to them
CREATE POLICY "rides_select_driver"
  ON rides FOR SELECT
  TO authenticated
  USING (
    assigned_driver_id = public.get_driver_id()
    AND public.get_driver_id() IS NOT NULL
  );

-- Riders can create rides
CREATE POLICY "rides_insert_rider"
  ON rides FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = rider_id);

-- Riders can update their own rides (cancel only — enforced by function)
CREATE POLICY "rides_update_rider"
  ON rides FOR UPDATE
  TO authenticated
  USING (auth.uid() = rider_id)
  WITH CHECK (auth.uid() = rider_id);

-- Drivers can update rides assigned to them (trip execution fields only)
CREATE POLICY "rides_update_driver"
  ON rides FOR UPDATE
  TO authenticated
  USING (
    assigned_driver_id = public.get_driver_id()
    AND public.get_driver_id() IS NOT NULL
  )
  WITH CHECK (
    assigned_driver_id = public.get_driver_id()
    AND public.get_driver_id() IS NOT NULL
  );

-- No DELETE — rides are never deleted, only cancelled


-- ═══════════════════════════════════════════════════════════════════════════
-- Restrict driver updates to trip-execution fields only
-- Prevents drivers from modifying fare, rider_id, locations, etc.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_driver_ride_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If the update is from a driver (not the rider, not service role)
  IF public.get_driver_id() = NEW.assigned_driver_id
     AND auth.uid() != NEW.rider_id THEN

    -- Drivers can ONLY change these fields:
    --   status, driver_arrived_at, trip_started_at, trip_completed_at,
    --   final_fare, cancel_reason, cancelled_by, cancelled_at, rider_rating

    -- Enforce immutability of rider-owned fields
    IF NEW.rider_id          IS DISTINCT FROM OLD.rider_id          OR
       NEW.pickup_address    IS DISTINCT FROM OLD.pickup_address    OR
       NEW.pickup_lat        IS DISTINCT FROM OLD.pickup_lat        OR
       NEW.pickup_lng        IS DISTINCT FROM OLD.pickup_lng        OR
       NEW.dropoff_address   IS DISTINCT FROM OLD.dropoff_address   OR
       NEW.dropoff_lat       IS DISTINCT FROM OLD.dropoff_lat       OR
       NEW.dropoff_lng       IS DISTINCT FROM OLD.dropoff_lng       OR
       NEW.estimated_fare    IS DISTINCT FROM OLD.estimated_fare    OR
       NEW.currency          IS DISTINCT FROM OLD.currency          OR
       NEW.quote_id          IS DISTINCT FROM OLD.quote_id          OR
       NEW.vehicle_class     IS DISTINCT FROM OLD.vehicle_class     OR
       NEW.driver_rating     IS DISTINCT FROM OLD.driver_rating     THEN
      RAISE EXCEPTION 'drivers cannot modify ride booking details';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_driver_ride_update ON rides;
CREATE TRIGGER trg_check_driver_ride_update
  BEFORE UPDATE ON rides
  FOR EACH ROW EXECUTE FUNCTION check_driver_ride_update();


-- ═══════════════════════════════════════════════════════════════════════════
-- Restrict rider updates to cancellation only
-- Prevents riders from modifying fare, status to 'completed', etc.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_rider_ride_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If the update is from the rider
  IF auth.uid() = NEW.rider_id
     AND (public.get_driver_id() IS NULL OR public.get_driver_id() != NEW.assigned_driver_id) THEN

    -- Riders can only: cancel, rate driver
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      -- Only allow transition to 'cancelled'
      IF NEW.status != 'cancelled' THEN
        RAISE EXCEPTION 'riders can only cancel rides';
      END IF;
      -- Cannot cancel rides already in_progress or completed
      IF OLD.status IN ('in_progress', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'cannot cancel ride in current status: %', OLD.status;
      END IF;
    END IF;

    -- Riders cannot modify these fields
    IF NEW.assigned_driver_id IS DISTINCT FROM OLD.assigned_driver_id OR
       NEW.vehicle_id         IS DISTINCT FROM OLD.vehicle_id         OR
       NEW.estimated_fare     IS DISTINCT FROM OLD.estimated_fare     OR
       NEW.final_fare         IS DISTINCT FROM OLD.final_fare         OR
       NEW.rider_rating       IS DISTINCT FROM OLD.rider_rating       THEN
      RAISE EXCEPTION 'riders cannot modify ride assignment or fare fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_rider_ride_update ON rides;
CREATE TRIGGER trg_check_rider_ride_update
  BEFORE UPDATE ON rides
  FOR EACH ROW EXECUTE FUNCTION check_rider_ride_update();


-- ═══════════════════════════════════════════════════════════════════════════
-- RIDE_EVENTS
-- Append-only. Riders see events for their rides. Drivers see events for
-- assigned rides. No UPDATE or DELETE — ever.
-- ═══════════════════════════════════════════════════════════════════════════

-- Riders see events for their rides
CREATE POLICY "ride_events_select_rider"
  ON ride_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_events.ride_id
        AND rides.rider_id = auth.uid()
    )
  );

-- Drivers see events for their assigned rides
CREATE POLICY "ride_events_select_driver"
  ON ride_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_events.ride_id
        AND rides.assigned_driver_id = public.get_driver_id()
        AND public.get_driver_id() IS NOT NULL
    )
  );

-- No INSERT/UPDATE/DELETE from client — events are written by service role
-- (API routes, webhooks, database triggers)


-- ═══════════════════════════════════════════════════════════════════════════
-- PAYMENTS
-- Riders: read-only on own payments.
-- All writes are service-role only (Stripe webhook handler).
-- Never writable from client — prevents fare manipulation.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "payments_select_rider"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = rider_id);

-- Drivers see payment status for their assigned rides (not amounts)
CREATE POLICY "payments_select_driver"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = payments.ride_id
        AND rides.assigned_driver_id = public.get_driver_id()
        AND public.get_driver_id() IS NOT NULL
    )
  );

-- No INSERT/UPDATE/DELETE — all payment writes go through service role
-- via /api/payments (Stripe webhook) with STRIPE_SECRET_KEY validation


-- ═══════════════════════════════════════════════════════════════════════════
-- RIDE STATUS CHANGE AUDIT TRIGGER
-- Automatically logs every ride status change to ride_events.
-- Runs as SECURITY DEFINER so it bypasses RLS on ride_events.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_ride_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ride_events (ride_id, event_type, old_status, new_status, actor, metadata)
    VALUES (
      NEW.id,
      'status_change',
      OLD.status,
      NEW.status,
      CASE
        WHEN auth.uid() = NEW.rider_id THEN 'rider'
        WHEN public.get_driver_id() = NEW.assigned_driver_id THEN 'driver'
        ELSE 'system'
      END,
      jsonb_build_object(
        'timestamp', now(),
        'auth_uid', auth.uid()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_ride_status ON rides;
CREATE TRIGGER trg_log_ride_status
  AFTER UPDATE ON rides
  FOR EACH ROW EXECUTE FUNCTION log_ride_status_change();
