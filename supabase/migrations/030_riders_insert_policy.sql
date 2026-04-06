-- ═══════════════════════════════════════════════════════════════════════════
-- 030 — Fix missing INSERT RLS policy on riders table
--
-- The riders table has RLS enabled but only SELECT and UPDATE policies.
-- Any INSERT attempt by a non-BYPASSRLS role is denied by default.
-- The handle_new_user() trigger runs SECURITY DEFINER as postgres
-- (which has BYPASSRLS), but this is a single fragile safety net.
--
-- This migration adds:
-- 1. riders_insert_own — lets auth'd users insert their own row
-- 2. riders_service_all — lets service_role do anything (matches
--    the profiles_service_all pattern already in place)
--
-- These policies ensure the trigger chain works even if
-- SECURITY DEFINER or BYPASSRLS behavior changes.
-- ═══════════════════════════════════════════════════════════════════════════

-- Allow authenticated users to insert their own rider row
-- (covers the handle_new_user trigger and any direct client writes)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'riders' AND policyname = 'riders_insert_own'
  ) THEN
    CREATE POLICY "riders_insert_own" ON public.riders
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Service-role wildcard (matches profiles_service_all pattern)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'riders' AND policyname = 'riders_service_all'
  ) THEN
    CREATE POLICY "riders_service_all" ON public.riders
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
