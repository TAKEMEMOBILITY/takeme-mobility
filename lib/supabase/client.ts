import { createBrowserClient } from '@supabase/ssr';

// Lazy singleton — NEVER initialized at module level.
// Only created on first call, and only in the browser.
let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // Return cached instance
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Guard: if env vars are missing, return a no-op stub
  if (!url || !key) {
    if (typeof window !== 'undefined') {
      console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
    }
    return createStub();
  }

  try {
    client = createBrowserClient(url, key);
    return client;
  } catch (err) {
    console.error('[Supabase] Failed to create client:', err);
    return createStub();
  }
}

// Minimal stub that matches the Supabase client shape without crashing.
// Every method returns safe defaults. Nothing throws.
function createStub() {
  const chain = () => {
    const obj: Record<string, unknown> = {
      data: null,
      error: null,
      then: (fn: (v: unknown) => unknown) => Promise.resolve(fn(obj)),
      eq: () => obj,
      neq: () => obj,
      in: () => obj,
      not: () => obj,
      single: () => Promise.resolve(obj),
      maybeSingle: () => Promise.resolve(obj),
      order: () => obj,
      limit: () => obj,
      select: () => obj,
      insert: () => Promise.resolve(obj),
      update: () => Promise.resolve(obj),
      delete: () => Promise.resolve(obj),
    };
    return obj;
  };

  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signUp: () => Promise.resolve({ data: null, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: () => chain(),
    channel: () => ({
      on: function() { return this; },
      subscribe: function() { return this; },
    }),
    removeChannel: () => {},
    rpc: () => Promise.resolve({ data: null, error: null }),
  } as unknown as ReturnType<typeof createBrowserClient>;
}
