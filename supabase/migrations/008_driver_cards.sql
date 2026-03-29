-- ═══════════════════════════════════════════════════════════════════════════
-- Driver Cards — Stripe Issuing integration table
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS driver_cards (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stripe Issuing IDs
  stripe_cardholder_id    TEXT,
  stripe_virtual_card_id  TEXT,
  stripe_physical_card_id TEXT,

  -- Status
  card_status             TEXT DEFAULT 'none'
                          CHECK (card_status IN ('none', 'cardholder_created', 'virtual_ready', 'needs_activation', 'active', 'frozen', 'cancelled')),
  shipping_status         TEXT DEFAULT 'none'
                          CHECK (shipping_status IN ('none', 'pending', 'shipped', 'delivered', 'returned')),

  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_cards_driver ON driver_cards(driver_id);

ALTER TABLE driver_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_cards_select_own" ON driver_cards
  FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "driver_cards_insert_own" ON driver_cards
  FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "driver_cards_update_own" ON driver_cards
  FOR UPDATE USING (auth.uid() = driver_id);
