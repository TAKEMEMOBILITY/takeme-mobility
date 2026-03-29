-- ═══════════════════════════════════════════════════════════════════════════
-- Driver Balance + Card Funding
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Driver balance (earnings available for payout)
CREATE TABLE IF NOT EXISTS driver_balances (
  driver_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available       NUMERIC(10,2) DEFAULT 0,    -- ready to transfer
  pending         NUMERIC(10,2) DEFAULT 0,    -- not yet cleared
  lifetime        NUMERIC(10,2) DEFAULT 0,    -- all-time earnings
  card_balance    NUMERIC(10,2) DEFAULT 0,    -- funds on TAKEME card
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE driver_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "balance_select_own" ON driver_balances FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "balance_update_own" ON driver_balances FOR UPDATE USING (auth.uid() = driver_id);

-- Fund transfer log
CREATE TABLE IF NOT EXISTS card_funding_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('to_card', 'from_card')),
  status          TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  stripe_topup_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funding_driver ON card_funding_log(driver_id);
ALTER TABLE card_funding_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funding_select_own" ON card_funding_log FOR SELECT USING (auth.uid() = driver_id);
