import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Store OTPs temporarily in memory
const otpStore = new Map<string, { code: string; expires: number }>();

export async function sendOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phoneNumber, { code, expires: Date.now() + 10 * 60 * 1000 });

    await sns.send(new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: `TakeMe verification code: ${code}`,
    }));

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { success: false, error: msg };
  }
}

export async function verifyOTP(phoneNumber: string, code: string): Promise<{ success: boolean; error?: string }> {
  const stored = otpStore.get(phoneNumber);
  if (!stored) return { success: false, error: "Code not found." };
  if (Date.now() > stored.expires) return { success: false, error: "Code expired." };
  if (stored.code !== code) return { success: false, error: "Invalid code." };
  
  otpStore.delete(phoneNumber);
  return { success: true };
}
