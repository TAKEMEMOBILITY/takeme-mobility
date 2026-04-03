-- 023 — Simulation logs for ops war-gaming
CREATE TABLE IF NOT EXISTS simulation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario text NOT NULL,
  service text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'warn', 'error')),
  latency_ms int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulation_logs_created ON simulation_logs (created_at DESC);
ALTER TABLE simulation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simulation_logs_all" ON simulation_logs FOR ALL USING (true) WITH CHECK (true);
