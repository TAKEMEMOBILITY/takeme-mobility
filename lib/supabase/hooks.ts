import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from './client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Lazy init — only in useEffect, never during render
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const supabase = createClient();
      supabaseRef.current = supabase;

      // Fetch current user
      supabase.auth.getUser()
        .then((result: { data: { user: User | null } }) => {
          setUser(result.data?.user ?? null);
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      // Listen for auth changes
      try {
        const { data } = supabase.auth.onAuthStateChange(
          (_event: unknown, session: unknown) => {
            const s = session as { user?: User | null } | null;
            setUser(s?.user ?? null);
            setLoading(false);
          },
        );
        subscription = data?.subscription ?? null;
      } catch {
        setLoading(false);
      }
    } catch (err) {
      console.error('[useAuth] Init failed:', err);
      setLoading(false);
    }

    return () => {
      try { subscription?.unsubscribe(); } catch {}
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const supabase = supabaseRef.current ?? createClient();
      return supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = supabaseRef.current ?? createClient();
      return supabase.auth.signInWithPassword({ email, password });
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = supabaseRef.current ?? createClient();
    return supabase.auth.signOut();
  }, []);

  return { user, loading, signUp, signIn, signOut };
}
