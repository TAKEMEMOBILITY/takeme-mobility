import { createServerClient } from '@supabase/ssr';

/**
 * Service-role Supabase client. Bypasses RLS.
 * Use ONLY in server-side code (API routes, webhooks, cron jobs).
 * Never import this on the client.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in environment.
 * Falls back to anon key ONLY in development — throws in production.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production');
    }
    console.warn('[service] SUPABASE_SERVICE_ROLE_KEY not set — using anon key (dev only)');
  }

  const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, key, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
