'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Auth Context — Phone OTP via Supabase
// Lazy-loads Supabase client. Never crashes if SDK is unavailable.
// ═══════════════════════════════════════════════════════════════════════════

interface User {
  id: string;
  phone?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<{ error: string | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  sendOtp: async () => ({ error: 'Not initialized' }),
  verifyOtp: async () => ({ error: 'Not initialized' }),
  signOut: async () => {},
});

function getSupabase() {
  try {
    const { createClient } = require('@/lib/supabase/client');
    return createClient();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef<ReturnType<typeof getSupabase>>(null);

  useEffect(() => {
    const sb = getSupabase();
    supabaseRef.current = sb;
    if (!sb) { setLoading(false); return; }

    sb.auth.getUser()
      .then((res: { data: { user: { id: string; phone?: string; email?: string } | null } }) => {
        const u = res.data?.user;
        if (u) setUser({ id: u.id, phone: u.phone, email: u.email });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    try {
      const { data } = sb.auth.onAuthStateChange(
        (_: unknown, session: { user?: { id: string; phone?: string; email?: string } } | null) => {
          if (session?.user) {
            setUser({ id: session.user.id, phone: session.user.phone, email: session.user.email });
          } else {
            setUser(null);
          }
          setLoading(false);
        },
      );
      return () => { try { data?.subscription?.unsubscribe(); } catch {} };
    } catch { setLoading(false); }
  }, []);

  const sendOtp = useCallback(async (phone: string): Promise<{ error: string | null }> => {
    const sb = supabaseRef.current ?? getSupabase();
    if (!sb) return { error: 'Auth service unavailable' };

    try {
      const { error } = await sb.auth.signInWithOtp({ phone });
      return { error: error?.message ?? null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Failed to send code' };
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, token: string): Promise<{ error: string | null }> => {
    const sb = supabaseRef.current ?? getSupabase();
    if (!sb) return { error: 'Auth service unavailable' };

    try {
      const { error } = await sb.auth.verifyOtp({ phone, token, type: 'sms' });
      return { error: error?.message ?? null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Verification failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    const sb = supabaseRef.current ?? getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, sendOtp, verifyOtp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
