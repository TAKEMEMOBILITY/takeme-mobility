-- ═══════════════════════════════════════════════════════════════════════════
-- TAKEME Card + Payout System
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

-- TAKEME Card records
CREATE TABLE IF NOT EXISTS takeme_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id       UUID,
  card_number_last4 TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'cancelled', 'pending')),
  balance         NUMERIC(10,2) DEFAULT 0,
  total_cashback  NUMERIC(10,2) DEFAULT 0,
  stripe_card_id  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takeme_cards_user ON takeme_cards(user_id);

ALTER TABLE takeme_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards_select_own" ON takeme_cards FOR SELECT USING (auth.uid() = user_id);

-- Card transactions
CREATE TABLE IF NOT EXISTS card_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         UUID NOT NULL REFERENCES takeme_cards(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('payout', 'cashout', 'cashback', 'refund', 'charge')),
  amount          NUMERIC(10,2) NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_txn_card ON card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_card_txn_user ON card_transactions(user_id);

ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_select_own" ON card_transactions FOR SELECT USING (auth.uid() = user_id);
