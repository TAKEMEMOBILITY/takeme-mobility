-- ═══════════════════════════════════════════════════════════════════════════
-- Driver verification + documents + auto-provisioning
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Document uploads
CREATE TABLE IF NOT EXISTS driver_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('license_front', 'license_back', 'insurance', 'registration', 'profile_photo', 'background_check')),
  file_url        TEXT NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at      TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_docs_driver ON driver_documents(driver_id);
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select_own" ON driver_documents FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "docs_insert_own" ON driver_documents FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- Add verification fields to driver_applications
DO $$ BEGIN
  ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS background_check_status TEXT DEFAULT 'not_started'
    CHECK (background_check_status IN ('not_started', 'pending', 'passed', 'failed'));
  ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS documents_complete BOOLEAN DEFAULT FALSE;
  ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
  ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS approved_by TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Function: provision driver after approval
-- Creates driver record, wallet, and triggers card issuance
CREATE OR REPLACE FUNCTION provision_approved_driver(
  p_application_id UUID
) RETURNS UUID AS $$
DECLARE
  app_record RECORD;
  new_driver_id UUID;
BEGIN
  -- Get application
  SELECT * INTO app_record FROM driver_applications WHERE id = p_application_id AND status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or not approved';
  END IF;

  -- Check if driver already exists
  SELECT id INTO new_driver_id FROM drivers WHERE auth_user_id = app_record.user_id;
  IF FOUND THEN
    RETURN new_driver_id;
  END IF;

  -- Create driver record
  INSERT INTO drivers (full_name, email, phone, license_number, status, is_verified, is_active, auth_user_id, accepts_pets)
  VALUES (app_record.full_name, app_record.email, app_record.phone, app_record.license_number,
          'offline', TRUE, TRUE, app_record.user_id, COALESCE(app_record.accepts_pets, FALSE))
  RETURNING id INTO new_driver_id;

  -- Create vehicle
  INSERT INTO vehicles (driver_id, vehicle_class, make, model, year, color, plate_number, is_active)
  VALUES (new_driver_id, app_record.vehicle_class::vehicle_class, app_record.vehicle_make,
          app_record.vehicle_model, app_record.vehicle_year, app_record.vehicle_color,
          app_record.plate_number, TRUE);

  -- Create wallet
  INSERT INTO driver_wallets (driver_id) VALUES (app_record.user_id)
  ON CONFLICT (driver_id) DO NOTHING;

  RETURN new_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
