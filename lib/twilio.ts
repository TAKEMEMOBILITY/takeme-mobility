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
    throw new Error(
      'Twilio credentials not configured. Missing: ' +
      [!accountSid && 'TWILIO_ACCOUNT_SID', !authToken && 'TWILIO_AUTH_TOKEN', !serviceSid && 'TWILIO_VERIFY_SERVICE_SID']
        .filter(Boolean).join(', ')
    );
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
  let creds;
  try {
    creds = getCredentials();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Credentials error';
    console.error('[Twilio] Credentials error:', msg);
    return { success: false, error: msg };
  }

  const url = `${TWILIO_API}/Services/${creds.serviceSid}/Verifications`;
  console.log('[Twilio] Sending verification to:', phone);
  console.log('[Twilio] URL:', url);
  console.log('[Twilio] Account SID prefix:', creds.accountSid.slice(0, 6) + '...');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(creds.accountSid, creds.authToken),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        Channel: 'sms',
      }).toString(),
    });

    const data = await res.json();

    console.log('[Twilio] Response status:', res.status);
    console.log('[Twilio] Response body:', JSON.stringify({
      status: data.status,
      sid: data.sid,
      code: data.code,
      message: data.message,
      moreInfo: data.more_info,
    }));

    if (!res.ok) {
      const errorMsg = data.message || `Twilio error (${res.status})`;
      // Common Twilio error codes
      if (data.code === 60200) return { success: false, error: 'Invalid phone number format.' };
      if (data.code === 60203) return { success: false, error: 'Too many verification attempts. Wait a few minutes.' };
      if (data.code === 60212) return { success: false, error: 'This number cannot receive SMS. Try a different number.' };
      if (data.code === 20003) return { success: false, error: 'SMS service authentication failed. Check Twilio credentials.' };
      if (data.code === 20404) return { success: false, error: 'Verify service not found. Check TWILIO_VERIFY_SERVICE_SID.' };
      if (res.status === 403) return { success: false, error: 'Twilio trial: this number is not verified. Add it at twilio.com/console/phone-numbers/verified.' };
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    console.error('[Twilio] Fetch error:', msg);
    return { success: false, error: `SMS service unreachable: ${msg}` };
  }
}

/**
 * Verify an OTP code.
 */
export async function checkVerification(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  let creds;
  try {
    creds = getCredentials();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Credentials error' };
  }

  try {
    const res = await fetch(
      `${TWILIO_API}/Services/${creds.serviceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader(creds.accountSid, creds.authToken),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          Code: code,
        }).toString(),
      },
    );

    const data = await res.json();

    console.log('[Twilio] Verify response:', res.status, data.status);

    if (!res.ok) {
      const errorMsg = data.message || 'Verification failed';
      if (data.code === 60202) return { success: false, error: 'Verification expired. Request a new code.' };
      if (data.code === 20404) return { success: false, error: 'No pending verification found. Request a new code.' };
      return { success: false, error: errorMsg };
    }

    if (data.status !== 'approved') {
      return { success: false, error: 'Invalid code. Please try again.' };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    console.error('[Twilio] Verify fetch error:', msg);
    return { success: false, error: `Verification service unreachable: ${msg}` };
  }
}
