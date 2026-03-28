-- ═══════════════════════════════════════════════════════════════════════════
-- TAKEME MOBILITY — Dispatch Functions
-- Server-side functions for driver matching and location management.
-- Run in Supabase Dashboard → SQL Editor AFTER 002_rls_policies.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- find_nearby_drivers
--
-- Returns available, verified drivers within a radius of a pickup point,
-- filtered by vehicle class, ordered by distance.
-- Called via service role from the dispatch API.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION find_nearby_drivers(
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  search_radius_m INTEGER DEFAULT 5000,
  ride_vehicle_class vehicle_class DEFAULT 'economy',
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  driver_rating NUMERIC,
  vehicle_id UUID,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  plate_number TEXT,
  distance_m DOUBLE PRECISION,
  heading NUMERIC,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    d.id AS driver_id,
    d.full_name AS driver_name,
    d.rating AS driver_rating,
    v.id AS vehicle_id,
    v.make AS vehicle_make,
    v.model AS vehicle_model,
    v.color AS vehicle_color,
    v.plate_number,
    ST_Distance(
      dl.location,
      ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
    ) AS distance_m,
    dl.heading,
    ST_Y(dl.location::geometry) AS lat,
    ST_X(dl.location::geometry) AS lng
  FROM drivers d
  JOIN driver_locations dl ON dl.driver_id = d.id
  JOIN vehicles v ON v.driver_id = d.id AND v.is_active = TRUE
  WHERE d.status = 'available'
    AND d.is_verified = TRUE
    AND d.is_active = TRUE
    AND v.vehicle_class = ride_vehicle_class
    AND ST_DWithin(
      dl.location,
      ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography,
      search_radius_m
    )
    AND dl.updated_at > now() - INTERVAL '5 minutes'  -- stale locations excluded
  ORDER BY distance_m ASC
  LIMIT max_results;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- upsert_driver_location
--
-- Inserts or updates a driver's GPS position. Called frequently from
-- the driver app. Uses ON CONFLICT for atomic upsert.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION upsert_driver_location(
  p_driver_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_heading NUMERIC DEFAULT NULL,
  p_speed_kmh NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO driver_locations (driver_id, location, heading, speed_kmh, updated_at)
  VALUES (
    p_driver_id,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_heading,
    p_speed_kmh,
    now()
  )
  ON CONFLICT (driver_id) DO UPDATE SET
    location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    heading = COALESCE(p_heading, driver_locations.heading),
    speed_kmh = COALESCE(p_speed_kmh, driver_locations.speed_kmh),
    updated_at = now();
END;
$$;
