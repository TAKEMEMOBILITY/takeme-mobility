-- Admin role for dashboard access
-- Add is_admin flag to riders table (auth.users-linked)

ALTER TABLE riders ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Mark initial admin (update with your user ID after first login)
-- UPDATE riders SET is_admin = true WHERE email = 'your-email@example.com';
