'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Auth Context — Phone OTP via custom API routes + Supabase session
//
// Send OTP: POST /api/auth/send-otp (Twilio Verify)
// Verify OTP: POST /api/auth/verify-otp (Twilio + Supabase user)
// Session: Supabase client tracks auth state after verify
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

  // Load existing session
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

  // Send OTP via custom API (Twilio Verify)
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

  // Verify OTP via custom API (Twilio + Supabase)
  const verifyOtp = useCallback(async (phone: string, code: string): Promise<{ error: string | null }> => {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json() as { verified?: boolean; userId?: string; error?: string };
      if (!res.ok) return { error: data.error || 'Verification failed' };

      if (data.verified && data.userId) {
        // Try to establish Supabase session via phone OTP
        const sb = supabaseRef.current ?? getSupabase();
        if (sb) {
          try {
            // Supabase phone auth — since Twilio already verified, this should work
            await sb.auth.signInWithOtp({ phone });
            const { error } = await sb.auth.verifyOtp({ phone, token: code, type: 'sms' });
            if (!error) {
              // Session is now set — onAuthStateChange will fire
              return { error: null };
            }
          } catch {}

          // Fallback: set user manually from API response
          setUser({ id: data.userId, phone });
        } else {
          setUser({ id: data.userId, phone });
        }
        return { error: null };
      }

      return { error: 'Verification failed' };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    const sb = supabaseRef.current ?? getSupabase();
    try { if (sb) await sb.auth.signOut(); } catch {}
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
