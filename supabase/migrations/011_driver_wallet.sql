-- ═══════════════════════════════════════════════════════════════════════════
-- Driver Wallet — full earnings + payout system
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Wallet (one per driver — extends driver_balances)
CREATE TABLE IF NOT EXISTS driver_wallets (
  driver_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available       NUMERIC(10,2) DEFAULT 0 CHECK (available >= 0),
  pending         NUMERIC(10,2) DEFAULT 0 CHECK (pending >= 0),
  lifetime        NUMERIC(10,2) DEFAULT 0,
  card_balance    NUMERIC(10,2) DEFAULT 0 CHECK (card_balance >= 0),
  stripe_account_id TEXT,        -- Stripe Connect account for payouts
  payout_method   TEXT DEFAULT 'takeme_card' CHECK (payout_method IN ('takeme_card', 'bank', 'debit')),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE driver_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_select_own" ON driver_wallets FOR SELECT USING (auth.uid() = driver_id);

-- Transactions (append-only ledger)
CREATE TABLE IF NOT EXISTS driver_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('ride_earning', 'tip', 'bonus', 'payout', 'card_fund', 'card_cashback', 'adjustment', 'fee')),
  amount          NUMERIC(10,2) NOT NULL,
  balance_after   NUMERIC(10,2),
  description     TEXT,
  ride_id         UUID,
  status          TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dtxn_driver ON driver_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_dtxn_type ON driver_transactions(type);
CREATE INDEX IF NOT EXISTS idx_dtxn_created ON driver_transactions(created_at DESC);

ALTER TABLE driver_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dtxn_select_own" ON driver_transactions FOR SELECT USING (auth.uid() = driver_id);

-- Payouts (tracks each payout attempt)
CREATE TABLE IF NOT EXISTS driver_payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,
  method          TEXT NOT NULL CHECK (method IN ('takeme_card', 'bank', 'debit')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'paid', 'failed', 'cancelled')),
  stripe_payout_id TEXT,
  stripe_transfer_id TEXT,
  failure_reason  TEXT,
  initiated_at    TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpayout_driver ON driver_payouts(driver_id);
CREATE INDEX IF NOT EXISTS idx_dpayout_status ON driver_payouts(status);

ALTER TABLE driver_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpayout_select_own" ON driver_payouts FOR SELECT USING (auth.uid() = driver_id);

-- Helper: add earnings atomically
CREATE OR REPLACE FUNCTION add_driver_earning(
  p_driver_id UUID,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'ride_earning',
  p_description TEXT DEFAULT NULL,
  p_ride_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  new_available NUMERIC;
BEGIN
  -- Upsert wallet
  INSERT INTO driver_wallets (driver_id, available, lifetime)
  VALUES (p_driver_id, p_amount, p_amount)
  ON CONFLICT (driver_id) DO UPDATE SET
    available = driver_wallets.available + p_amount,
    lifetime = driver_wallets.lifetime + p_amount,
    updated_at = now();

  -- Get new balance
  SELECT available INTO new_available FROM driver_wallets WHERE driver_id = p_driver_id;

  -- Log transaction
  INSERT INTO driver_transactions (driver_id, type, amount, balance_after, description, ride_id, status)
  VALUES (p_driver_id, p_type, p_amount, new_available, p_description, p_ride_id, 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
