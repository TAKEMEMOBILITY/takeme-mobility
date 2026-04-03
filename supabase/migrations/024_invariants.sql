-- 024 — Invariant tables: payment audit log + invariant check log

CREATE TABLE IF NOT EXISTS payment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid,
  amount int,
  currency text DEFAULT 'usd',
  status text NOT NULL, -- processing / succeeded / failed / duplicate_blocked
  stripe_payment_intent_id text,
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_ride ON payment_audit_log (ride_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_audit_created ON payment_audit_log (created_at DESC);
ALTER TABLE payment_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_audit_log_all" ON payment_audit_log FOR ALL USING (true) WITH CHECK (true);
REVOKE DELETE ON payment_audit_log FROM authenticated;
REVOKE DELETE ON payment_audit_log FROM anon;

CREATE TABLE IF NOT EXISTS invariant_check_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  status text NOT NULL, -- pass / fail / warn
  details text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invariant_check_created ON invariant_check_log (created_at DESC);
ALTER TABLE invariant_check_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invariant_check_log_all" ON invariant_check_log FOR ALL USING (true) WITH CHECK (true);

-- Failed emails dead letter queue
CREATE TABLE IF NOT EXISTS failed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_address text NOT NULL,
  subject text,
  body text,
  error text,
  retries int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE failed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "failed_emails_all" ON failed_emails FOR ALL USING (true) WITH CHECK (true);
