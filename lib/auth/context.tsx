'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Auth Context — Phone OTP
//
// OTP sent/verified via custom API routes (Twilio + Supabase Admin).
// Session is set server-side via cookies in the verify-otp route.
// After verify succeeds, client refreshes auth state from Supabase.
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
  verifyOtp: (phone: string, code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  sendOtp: async () => ({ error: 'Not initialized' }),
  verifyOtp: async () => ({ error: 'Not initialized' }),
  signOut: async () => {},
  refreshUser: async () => {},
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

  const fetchUser = useCallback(async () => {
    const sb = supabaseRef.current ?? getSupabase();
    supabaseRef.current = sb;
    if (!sb) { setLoading(false); return; }

    try {
      const res = await sb.auth.getUser();
      const u = res?.data?.user;
      if (u) {
        setUser({ id: u.id, phone: u.phone, email: u.email });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auth state listener
  useEffect(() => {
    fetchUser();

    const sb = supabaseRef.current;
    if (!sb) return;

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
    } catch {}
  }, [fetchUser]);

  // Send OTP via Twilio
  const sendOtp = useCallback(async (phone: string): Promise<{ error: string | null }> => {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Failed to send code' };
      return { error: null };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  }, []);

  // Verify OTP — server sets session cookies, then we refresh client state
  const verifyOtp = useCallback(async (phone: string, code: string): Promise<{ error: string | null }> => {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json() as { verified?: boolean; error?: string };
      if (!res.ok) return { error: data.error || 'Verification failed' };

      if (data.verified) {
        // Session cookies are set by the server response.
        // Re-fetch user to pick up the new session.
        await fetchUser();
        return { error: null };
      }

      return { error: 'Verification failed' };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  }, [fetchUser]);

  const signOut = useCallback(async () => {
    const sb = supabaseRef.current ?? getSupabase();
    try { if (sb) await sb.auth.signOut(); } catch {}
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, sendOtp, verifyOtp, signOut, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
