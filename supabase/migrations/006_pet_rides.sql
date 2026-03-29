-- ═══════════════════════════════════════════════════════════════════════════
-- Pet Ride System
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Add pet columns to bookings
DO $$ BEGIN
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_type TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_size TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_notes TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_fee NUMERIC(10,2) DEFAULT 0;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Update vehicle_type check to include pet_ride
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_vehicle_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_vehicle_type_check
  CHECK (vehicle_type IN ('electric', 'comfort_electric', 'premium_electric', 'suv_electric', 'women_rider', 'pet_ride'));

-- Add pet preference to drivers
DO $$ BEGIN
  ALTER TABLE drivers ADD COLUMN IF NOT EXISTS accepts_pets BOOLEAN DEFAULT FALSE;
  ALTER TABLE drivers ADD COLUMN IF NOT EXISTS max_pet_size TEXT DEFAULT 'large';
  ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pet_conditions TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add pet preference to driver_applications
DO $$ BEGIN
  ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS accepts_pets BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN others THEN NULL;
END $$;
