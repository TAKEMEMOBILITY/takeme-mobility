-- ═══════════════════════════════════════════════════════════════════════════
-- OTP store: persistent, serverless-safe OTP storage with rate limiting
-- Replaces in-memory Map that fails across Vercel serverless instances
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS otp_codes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone       text NOT NULL,
  code        text NOT NULL,
  expires_at  timestamptz NOT NULL,
  verified    boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Fast lookup by phone, auto-cleanup of expired codes
CREATE INDEX idx_otp_codes_phone ON otp_codes (phone, expires_at DESC);

-- Rate limiting table: tracks SMS send attempts per phone
CREATE TABLE IF NOT EXISTS otp_rate_limits (
  phone       text PRIMARY KEY,
  attempts    int DEFAULT 1,
  window_start timestamptz DEFAULT now()
);

-- ── Store OTP (with rate limit check) ────────────────────────────────────
CREATE OR REPLACE FUNCTION store_otp(
  p_phone text,
  p_code  text,
  p_ttl_seconds int DEFAULT 600
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempts int;
  v_window_start timestamptz;
BEGIN
  -- Check rate limit: max 3 attempts per 5-minute window
  SELECT attempts, window_start INTO v_attempts, v_window_start
  FROM otp_rate_limits WHERE phone = p_phone;

  IF v_attempts IS NOT NULL THEN
    IF v_window_start > now() - interval '5 minutes' THEN
      IF v_attempts >= 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Please wait 5 minutes.');
      END IF;
      UPDATE otp_rate_limits SET attempts = attempts + 1 WHERE phone = p_phone;
    ELSE
      -- Window expired, reset
      UPDATE otp_rate_limits SET attempts = 1, window_start = now() WHERE phone = p_phone;
    END IF;
  ELSE
    INSERT INTO otp_rate_limits (phone, attempts, window_start) VALUES (p_phone, 1, now());
  END IF;

  -- Invalidate previous codes for this phone
  DELETE FROM otp_codes WHERE phone = p_phone;

  -- Store new code
  INSERT INTO otp_codes (phone, code, expires_at)
  VALUES (p_phone, p_code, now() + (p_ttl_seconds || ' seconds')::interval);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── Verify OTP ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_otp(p_phone text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM otp_codes
  WHERE phone = p_phone
    AND code = p_code
    AND expires_at > now()
    AND verified = false
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired code.');
  END IF;

  -- Mark as verified and delete
  DELETE FROM otp_codes WHERE id = v_id;

  -- Reset rate limit on successful verification
  DELETE FROM otp_rate_limits WHERE phone = p_phone;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── Cleanup expired codes (call periodically or via pg_cron) ─────────────
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM otp_codes WHERE expires_at < now();
  DELETE FROM otp_rate_limits WHERE window_start < now() - interval '10 minutes';
$$;
