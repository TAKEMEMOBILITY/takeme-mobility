// ═══════════════════════════════════════════════════════════════════════════
// SMS OTP — Supabase Phone Auth (Twilio Verify)
//
// Supabase handles OTP generation, SMS delivery (via Twilio Verify),
// and verification automatically. No AWS SNS needed.
// ═══════════════════════════════════════════════════════════════════════════

import { createServiceClient } from '@/lib/supabase/service'

export async function sendOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient()

    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
    })

    if (error) {
      console.error('[sms] signInWithOtp failed:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    console.error('[sms] sendOTP error:', msg)
    return { success: false, error: msg }
  }
}

export async function verifyOTP(phoneNumber: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneNumber,
      token: code,
      type: 'sms',
    })

    if (error) {
      console.error('[sms] verifyOtp failed:', error.message)
      return { success: false, error: error.message }
    }

    if (!data.session) {
      return { success: false, error: 'Verification failed — no session created.' }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed.'
    console.error('[sms] verifyOTP error:', msg)
    return { success: false, error: msg }
  }
}
