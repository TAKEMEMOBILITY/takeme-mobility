import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { createServiceClient } from "@/lib/supabase/service";

const sns = new SNSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const supabase = createServiceClient();

    // Store OTP with rate limit check (max 3 per 5 min, 10 min TTL)
    const { data, error: rpcError } = await supabase.rpc('store_otp', {
      p_phone: phoneNumber,
      p_code: code,
      p_ttl_seconds: 600,
    });

    if (rpcError) {
      console.error('[sms] store_otp RPC failed:', rpcError.message);
      return { success: false, error: 'Could not generate code.' };
    }

    const result = data as { success: boolean; error?: string };
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Send SMS via AWS SNS
    await sns.send(new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: `Your TakeMe verification code: ${code}`,
    }));

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { success: false, error: msg };
  }
}

export async function verifyOTP(phoneNumber: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();

    const { data, error: rpcError } = await supabase.rpc('verify_otp', {
      p_phone: phoneNumber,
      p_code: code,
    });

    if (rpcError) {
      console.error('[sms] verify_otp RPC failed:', rpcError.message);
      return { success: false, error: 'Verification failed.' };
    }

    return data as { success: boolean; error?: string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verification failed.";
    return { success: false, error: msg };
  }
}
