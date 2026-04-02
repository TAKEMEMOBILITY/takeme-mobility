-- ═══════════════════════════════════════════════════════════════════════════
-- EV Rental System
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE rental_status AS ENUM (
  'pending', 'confirmed', 'active', 'completed', 'cancelled', 'refunded'
);

CREATE TABLE rentals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_key       text NOT NULL,               -- key into fleet catalog (e.g. "tesla-model-3-lr")
  vehicle_name      text NOT NULL,               -- display name snapshot
  category          text NOT NULL,               -- sedan, suv, truck, luxury, performance
  daily_rate        decimal(10,2) NOT NULL,
  total_days        int NOT NULL,
  subtotal          decimal(10,2) NOT NULL,       -- daily_rate * total_days
  addons            jsonb DEFAULT '[]',           -- [{name, price}]
  addons_total      decimal(10,2) DEFAULT 0,
  total_amount      decimal(10,2) NOT NULL,
  currency          char(3) DEFAULT 'usd',
  pickup_date       date NOT NULL,
  return_date       date NOT NULL,
  pickup_location   text NOT NULL,
  status            rental_status DEFAULT 'pending',
  stripe_payment_intent text,
  stripe_session_id text,
  confirmation_code text,                         -- e.g. TM-XXXX
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_rentals_user     ON rentals (user_id);
CREATE INDEX idx_rentals_status   ON rentals (status);
CREATE INDEX idx_rentals_dates    ON rentals (pickup_date, return_date);
CREATE INDEX idx_rentals_created  ON rentals (created_at DESC);

ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

-- Users can see own rentals
CREATE POLICY "Users can view own rentals"
  ON rentals FOR SELECT
  USING (auth.uid() = user_id);

-- Service role handles inserts/updates (API routes)

CREATE TRIGGER trg_rentals_updated
  BEFORE UPDATE ON rentals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
