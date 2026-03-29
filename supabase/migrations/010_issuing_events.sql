-- ═══════════════════════════════════════════════════════════════════════════
-- Issuing webhook events + balance helper
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Event log for Issuing webhooks
CREATE TABLE IF NOT EXISTS issuing_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  stripe_id   TEXT NOT NULL,
  user_id     UUID,
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issuing_events_type ON issuing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_issuing_events_user ON issuing_events(user_id);

-- RPC to safely decrement card balance
CREATE OR REPLACE FUNCTION decrement_card_balance(p_driver_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE driver_balances
  SET card_balance = GREATEST(0, card_balance - p_amount),
      updated_at = now()
  WHERE driver_id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
