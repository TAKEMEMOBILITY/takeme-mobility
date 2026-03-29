-- ═══════════════════════════════════════════════════════════════════════════
-- TAKEME Card — Virtual + Physical Card System
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Driver payout preferences
DO $$ BEGIN
  ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'takeme_card'
    CHECK (payout_method IN ('takeme_card', 'bank', 'debit'));
  ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_account_last4 TEXT;
  ALTER TABLE drivers ADD COLUMN IF NOT EXISTS debit_card_last4 TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- TAKEME Card records (virtual + physical)
CREATE TABLE IF NOT EXISTS takeme_cards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id         UUID,

  -- Card identity
  card_number_last4 TEXT NOT NULL,
  card_type         TEXT NOT NULL DEFAULT 'virtual' CHECK (card_type IN ('virtual', 'physical')),

  -- Status
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'cancelled', 'pending')),
  virtual_ready     BOOLEAN DEFAULT TRUE,
  physical_status   TEXT DEFAULT 'none' CHECK (physical_status IN ('none', 'ordered', 'shipping', 'delivered')),
  physical_ordered_at TIMESTAMPTZ,
  physical_delivered_at TIMESTAMPTZ,

  -- Wallet
  wallet_added      BOOLEAN DEFAULT FALSE,
  wallet_type       TEXT, -- 'apple_pay', 'google_pay'

  -- Financial
  balance           NUMERIC(10,2) DEFAULT 0,
  total_cashback    NUMERIC(10,2) DEFAULT 0,
  cashback_rate_ev  NUMERIC(4,2) DEFAULT 5.00,   -- 5% EV charging
  cashback_rate_gas NUMERIC(4,2) DEFAULT 3.00,   -- 3% gas
  cashback_rate_other NUMERIC(4,2) DEFAULT 1.00, -- 1% everything else

  -- Stripe
  stripe_card_id    TEXT,
  stripe_cardholder_id TEXT,

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takeme_cards_user ON takeme_cards(user_id);

ALTER TABLE takeme_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cards_select_own" ON takeme_cards;
CREATE POLICY "cards_select_own" ON takeme_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cards_update_own" ON takeme_cards FOR UPDATE USING (auth.uid() = user_id);

-- Card transactions (ledger)
CREATE TABLE IF NOT EXISTS card_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         UUID NOT NULL REFERENCES takeme_cards(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('payout', 'cashout', 'cashback', 'refund', 'charge', 'reward')),
  amount          NUMERIC(10,2) NOT NULL,
  description     TEXT,
  category        TEXT, -- 'ev_charging', 'gas', 'ride_payout', 'cashback_reward'
  status          TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_txn_card ON card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_card_txn_user ON card_transactions(user_id);

ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "txn_select_own" ON card_transactions;
CREATE POLICY "txn_select_own" ON card_transactions FOR SELECT USING (auth.uid() = user_id);
