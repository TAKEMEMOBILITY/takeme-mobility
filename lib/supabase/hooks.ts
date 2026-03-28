import { useCallback, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from './client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: User | null } | null) => {
        setUser(session?.user || null);
        setLoading(false);
      },
    );

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      return supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      return supabase.auth.signInWithPassword({ email, password });
    },
    []
  );

  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, []);

  return {
    user,
    loading,
    signUp,
    signIn,
    signOut,
  };
}
