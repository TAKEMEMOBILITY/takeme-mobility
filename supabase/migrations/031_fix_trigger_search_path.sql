-- ═══════════════════════════════════════════════════════════════════════════
-- 031 — Fix trigger functions: set search_path + grant execute
--
-- Root cause of "Database error saving new user":
--
-- GoTrue runs as supabase_auth_admin (not postgres). When it inserts into
-- auth.users, our AFTER INSERT triggers fire. The trigger functions are
-- SECURITY DEFINER owned by postgres (which has BYPASSRLS), but they had
-- no explicit search_path set. When called from the auth schema context
-- by supabase_auth_admin, the function's default search_path can fail to
-- resolve unqualified table names like "riders" and "profiles".
--
-- Fix: recreate both functions with SET search_path = public, and
-- fully qualify all table references as public.riders / public.profiles.
-- Also grant USAGE on the user_role enum type to supabase_auth_admin.
-- ═══════════════════════════════════════════════════════════════════════════

-- Grant enum usage to auth admin (needed for riders.role DEFAULT)
GRANT USAGE ON TYPE public.user_role TO supabase_auth_admin;

-- Recreate handle_new_user with explicit search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.riders (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate handle_new_user_profile with explicit search_path
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure triggers still point to these functions (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Ensure supabase_auth_admin can insert into both tables
GRANT INSERT ON public.riders TO supabase_auth_admin;
GRANT INSERT ON public.profiles TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
