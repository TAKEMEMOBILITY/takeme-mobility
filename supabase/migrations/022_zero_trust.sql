-- ═══════════════════════════════════════════════════════════════════════════
-- 022 — Zero Trust Security Architecture
-- "Trust no one. Verify everything."
-- ═══════════════════════════════════════════════════════════════════════════

-- Roles enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'user',
    'backoffice_staff',
    'support_manager',
    'ops_core',
    'exec_founder',
    'security_owner',
    'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend profiles (riders table is used as profiles in this codebase)
ALTER TABLE riders
  ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS mfa_enabled bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trusted_ips text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trusted_devices text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_timeout_minutes int DEFAULT 60,
  ADD COLUMN IF NOT EXISTS failed_attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Permissions table (action-level RBAC)
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  allowed bool NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup ON role_permissions (role, resource, action);

-- Audit log (immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_role user_role,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id text,
  ip_address text,
  device_fingerprint text,
  user_agent text,
  session_id text,
  success bool NOT NULL,
  risk_score int DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk ON audit_logs (risk_score DESC) WHERE risk_score > 50;

-- Revoke UPDATE/DELETE on audit_logs from non-service roles
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON audit_logs FROM anon;

-- Secure sessions
CREATE TABLE IF NOT EXISTS secure_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text UNIQUE NOT NULL,
  ip_address text,
  device_fingerprint text,
  user_agent text,
  mfa_verified bool DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_activity timestamptz DEFAULT now(),
  revoked bool DEFAULT false,
  revoke_reason text
);

CREATE INDEX IF NOT EXISTS idx_secure_sessions_user ON secure_sessions (user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_secure_sessions_token ON secure_sessions (session_token) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_secure_sessions_expires ON secure_sessions (expires_at) WHERE revoked = false;

-- IP allowlist
CREATE TABLE IF NOT EXISTS ip_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_cidr text NOT NULL,
  description text,
  allowed_roles user_role[],
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Audit logs: read only by security_owner and super_admin
CREATE POLICY "audit_logs_read" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE id = auth.uid()
      AND role IN ('security_owner', 'super_admin')
    )
  );

-- Audit logs: insert allowed for service role (already bypasses RLS)
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Secure sessions: users see own, admins see all
CREATE POLICY "sessions_own" ON secure_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "sessions_admin" ON secure_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE id = auth.uid()
      AND role IN ('security_owner', 'super_admin')
    )
  );

CREATE POLICY "sessions_insert" ON secure_sessions
  FOR INSERT WITH CHECK (true);

-- IP allowlist: readable by ops+, writable by security+
CREATE POLICY "ip_allowlist_read" ON ip_allowlist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE id = auth.uid()
      AND role IN ('ops_core', 'exec_founder', 'security_owner', 'super_admin')
    )
  );

CREATE POLICY "ip_allowlist_write" ON ip_allowlist
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE id = auth.uid()
      AND role IN ('security_owner', 'super_admin')
    )
  );

-- Role permissions: readable by all authenticated
CREATE POLICY "role_permissions_read" ON role_permissions
  FOR SELECT USING (true);

-- ═══ Seed permissions ════════════════════════════════════════════════════

INSERT INTO role_permissions (role, resource, action, allowed) VALUES
-- backoffice_staff
('backoffice_staff','drivers','read',true),
('backoffice_staff','drivers','write',false),
('backoffice_staff','riders','read',true),
('backoffice_staff','payments','read',false),
('backoffice_staff','monitoring','read',false),
('backoffice_staff','dashboard','read',false),

-- support_manager
('support_manager','drivers','read',true),
('support_manager','drivers','write',true),
('support_manager','riders','read',true),
('support_manager','payments','read',true),
('support_manager','reports','read',true),
('support_manager','monitoring','read',false),

-- ops_core
('ops_core','monitoring','read',true),
('ops_core','monitoring','write',true),
('ops_core','drivers','read',true),
('ops_core','drivers','write',true),
('ops_core','payments','read',true),
('ops_core','dashboard','read',false),
('ops_core','security','read',false),

-- exec_founder
('exec_founder','dashboard','read',true),
('exec_founder','dashboard','export',true),
('exec_founder','monitoring','read',true),
('exec_founder','admin','read',true),
('exec_founder','drivers','read',true),
('exec_founder','drivers','write',true),
('exec_founder','riders','read',true),
('exec_founder','payments','read',true),
('exec_founder','security','read',false),

-- security_owner
('security_owner','security','read',true),
('security_owner','security','write',true),
('security_owner','audit_logs','read',true),
('security_owner','monitoring','read',true),
('security_owner','ip_allowlist','write',true),

-- super_admin (wildcard)
('super_admin','*','*',true)

ON CONFLICT DO NOTHING;

-- Set founder role
UPDATE riders SET
  role = 'exec_founder',
  mfa_enabled = true,
  session_timeout_minutes = 15
WHERE email = 'acilholding@gmail.com';

-- Helper function: check permission server-side
CREATE OR REPLACE FUNCTION check_role_permission(
  p_role user_role,
  p_resource text,
  p_action text
) RETURNS bool
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Super admin wildcard
  IF p_role = 'super_admin' THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = p_role
    AND (
      (resource = p_resource AND action = p_action AND allowed = true)
      OR (resource = '*' AND action = '*' AND allowed = true)
    )
  );
END;
$$;
