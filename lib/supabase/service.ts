import { createServerClient } from '@supabase/ssr';

/**
 * Service-role Supabase client. Bypasses RLS.
 * Use ONLY in server-side code (API routes, webhooks, cron jobs).
 * Never import this on the client.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, key, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
