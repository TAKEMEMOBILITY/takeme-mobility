-- ═══════════════════════════════════════════════════════════════════════════
-- Fraud detection system: events, device bans, scoring
-- ═══════════════════════════════════════════════════════════════════════════

-- Fraud events log (all detected fraud attempts)
CREATE TABLE IF NOT EXISTS fraud_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid,
  ride_id       uuid,
  driver_id     uuid,
  event_type    text NOT NULL,
  severity      text NOT NULL DEFAULT 'low',
  fraud_score   int NOT NULL DEFAULT 0,
  details       jsonb DEFAULT '{}',
  device_fingerprint text,
  ip_address    text,
  action_taken  text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_events_user ON fraud_events (user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_events_type ON fraud_events (event_type);
CREATE INDEX IF NOT EXISTS idx_fraud_events_severity ON fraud_events (severity);
CREATE INDEX IF NOT EXISTS idx_fraud_events_created ON fraud_events (created_at DESC);

-- Device bans (permanent, survives account deletion)
CREATE TABLE IF NOT EXISTS device_bans (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_fingerprint text NOT NULL,
  ip_address      text,
  user_id         uuid,
  reason          text NOT NULL,
  banned_by       text DEFAULT 'system',
  evidence        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_bans_fingerprint ON device_bans (device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_bans_ip ON device_bans (ip_address);

-- Trip fraud scores (per-trip scoring)
CREATE TABLE IF NOT EXISTS trip_fraud_scores (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id       uuid NOT NULL,
  score         int NOT NULL DEFAULT 0,
  checks        jsonb DEFAULT '{}',
  flagged       boolean DEFAULT false,
  auto_cancelled boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_fraud_ride ON trip_fraud_scores (ride_id);
CREATE INDEX IF NOT EXISTS idx_trip_fraud_flagged ON trip_fraud_scores (flagged) WHERE flagged = true;

-- Driver-rider pair tracking (for collusion detection)
CREATE TABLE IF NOT EXISTS ride_pair_counts (
  driver_id     uuid NOT NULL,
  rider_id      uuid NOT NULL,
  ride_count    int DEFAULT 1,
  last_ride_at  timestamptz DEFAULT now(),
  PRIMARY KEY (driver_id, rider_id)
);

-- Phone/email reuse tracking
CREATE TABLE IF NOT EXISTS account_identifiers (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL,
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  device_fingerprint text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_ids_value ON account_identifiers (identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_account_ids_device ON account_identifiers (device_fingerprint);
