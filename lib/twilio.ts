// ═══════════════════════════════════════════════════════════════════════════
// Twilio Verify — Send and verify OTP codes via REST API
// Uses fetch directly (no twilio npm package) to avoid bundling issues.
// ═══════════════════════════════════════════════════════════════════════════

const TWILIO_API = 'https://verify.twilio.com/v2';

function getCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Twilio credentials not configured');
  }

  return { accountSid, authToken, serviceSid };
}

function authHeader(accountSid: string, authToken: string): string {
  const encoded = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Send OTP verification code to a phone number.
 */
export async function sendVerification(phone: string): Promise<{ success: boolean; error?: string }> {
  const { accountSid, authToken, serviceSid } = getCredentials();

  const res = await fetch(
    `${TWILIO_API}/Services/${serviceSid}/Verifications`,
    {
      method: 'POST',
      headers: {
        'Authorization': authHeader(accountSid, authToken),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        Channel: 'sms',
      }).toString(),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    console.error('[Twilio] Send failed:', data);
    return { success: false, error: data.message || 'Failed to send verification code' };
  }

  return { success: true };
}

/**
 * Verify an OTP code.
 */
export async function checkVerification(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  const { accountSid, authToken, serviceSid } = getCredentials();

  const res = await fetch(
    `${TWILIO_API}/Services/${serviceSid}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        'Authorization': authHeader(accountSid, authToken),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        Code: code,
      }).toString(),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    console.error('[Twilio] Verify failed:', data);
    return { success: false, error: data.message || 'Verification failed' };
  }

  if (data.status !== 'approved') {
    return { success: false, error: 'Invalid or expired code' };
  }

  return { success: true };
}
