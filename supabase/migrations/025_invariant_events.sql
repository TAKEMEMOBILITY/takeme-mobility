-- 025 — Invariant violations (immutable) + metrics snapshots

CREATE TABLE IF NOT EXISTS invariant_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invariant text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('CRITICAL','HIGH','MEDIUM')),
  violation text NOT NULL,
  context jsonb DEFAULT '{}',
  auto_resolved bool DEFAULT false,
  resolution_time_ms int,
  system_mode_before text,
  system_mode_after text,
  shadow bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_violations_created ON invariant_violations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_violations_invariant ON invariant_violations (invariant, created_at DESC);
ALTER TABLE invariant_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_violations_all" ON invariant_violations FOR ALL USING (true) WITH CHECK (true);
REVOKE UPDATE, DELETE ON invariant_violations FROM authenticated;
REVOKE UPDATE, DELETE ON invariant_violations FROM anon;

CREATE TABLE IF NOT EXISTS invariant_metrics_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invariant text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  violations int DEFAULT 0,
  near_misses int DEFAULT 0,
  shadow_violations int DEFAULT 0,
  avg_recovery_ms int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(invariant, date)
);

ALTER TABLE invariant_metrics_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_metrics_all" ON invariant_metrics_log FOR ALL USING (true) WITH CHECK (true);
