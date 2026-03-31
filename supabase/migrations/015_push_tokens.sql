-- ═══════════════════════════════════════════════════════════════════════════
-- Push notification tokens for Expo Push API
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_tokens (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL,
  token       text NOT NULL,
  platform    text NOT NULL DEFAULT 'ios',
  role        text NOT NULL DEFAULT 'rider',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_role ON push_tokens (role);
