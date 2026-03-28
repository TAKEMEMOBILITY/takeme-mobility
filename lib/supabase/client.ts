import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;

  if (!supabaseUrl || !supabaseKey) {
    // Return a stub that won't crash during SSR/build when env vars are missing.
    // All auth operations will fail gracefully at runtime.
    if (typeof window === 'undefined') {
      return createSafeStub();
    }
    console.warn('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return createSafeStub();
  }

  client = createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}

// Stub client that returns empty/null for all operations without crashing
function createSafeStub(): ReturnType<typeof createBrowserClient> {
  const noop = () => ({ data: null, error: { message: 'Supabase not configured', status: 500 } });
  const noopAsync = async () => noop();

  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signUp: noopAsync,
      signInWithPassword: noopAsync,
      signOut: async () => ({ error: null }),
      onAuthStateChange: (_event: string, _callback: unknown) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: () => ({
      select: () => ({ data: null, error: { message: 'Not configured' } }),
      insert: () => ({ data: null, error: { message: 'Not configured' } }),
      update: () => ({ data: null, error: { message: 'Not configured' } }),
      delete: () => ({ data: null, error: { message: 'Not configured' } }),
      eq: function() { return this; },
      single: function() { return this; },
      maybeSingle: function() { return this; },
      order: function() { return this; },
      limit: function() { return this; },
      not: function() { return this; },
      in: function() { return this; },
    }),
    channel: () => ({
      on: function() { return this; },
      subscribe: function() { return this; },
    }),
    removeChannel: () => {},
  } as unknown as ReturnType<typeof createBrowserClient>;
}
