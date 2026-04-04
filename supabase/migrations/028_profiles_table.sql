-- ═══════════════════════════════════════════════════════════════════════════
-- 028 — Profiles table + admin user setup
-- ═══════════════════════════════════════════════════════════════════════════

-- Create profiles table (referenced by monitoring/health checks)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'rider',
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read profiles
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Service role can do anything
CREATE POLICY "profiles_service_all" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-create profile on new user signup
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Set the first user as admin (both riders and profiles tables)
DO $$
DECLARE first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    -- Update riders table (used by requireAdmin)
    UPDATE public.riders SET is_admin = true WHERE id = first_user_id;
    -- Insert/update profiles table
    INSERT INTO public.profiles (id, role, is_admin)
    VALUES (first_user_id, 'admin', true)
    ON CONFLICT (id) DO UPDATE SET is_admin = true, role = 'admin';
  END IF;
END $$;
