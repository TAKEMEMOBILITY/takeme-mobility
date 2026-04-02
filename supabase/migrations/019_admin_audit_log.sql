-- ═══════════════════════════════════════════════════════════════════════════
-- Admin Audit Log — tracks every admin action for accountability
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid NOT NULL REFERENCES auth.users(id),
  admin_email   text NOT NULL,
  action        text NOT NULL,
  target_type   text NOT NULL,          -- ride, driver, user, payment, fraud, system
  target_id     text,                    -- ID of the affected resource
  details       jsonb DEFAULT '{}',      -- action-specific payload
  ip_address    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_admin    ON admin_audit_log (admin_id);
CREATE INDEX idx_audit_log_action   ON admin_audit_log (action);
CREATE INDEX idx_audit_log_target   ON admin_audit_log (target_type, target_id);
CREATE INDEX idx_audit_log_created  ON admin_audit_log (created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write audit logs (admin API routes)
-- No client-side access at all
