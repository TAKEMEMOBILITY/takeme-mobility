-- Fix: handle_new_user() trigger must tolerate duplicate rider rows.
-- signInWithOtp({ email }) can re-insert into auth.users for existing phone
-- users, firing this trigger again. ON CONFLICT DO NOTHING prevents the
-- "Database error saving new user" crash.
-- Temporary safety net — remove email OTP once AWS SMS Production Access is approved.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO riders (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
