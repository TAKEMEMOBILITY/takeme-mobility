import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, useSupabase } from './supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

interface AuthActions {
  sendOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  // Temporary email OTP fallback — remove once AWS SMS Production Access is approved
  sendEmailOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmailOtp: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

const DEV_OTP = '123456';

// ---------------------------------------------------------------------------
// Dev auth: fully client-side, no Supabase auth calls.
// Creates a mock user/session so the entire app works without SMS or
// any Supabase auth configuration.
//
// Set EXPO_PUBLIC_AUTH_MODE=production in .env.local to use real auth.
// ---------------------------------------------------------------------------
const AUTH_MODE = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'dev';

function createDevUser(phone: string): User {
  const digits = phone.replace(/\D/g, '');
  const id = `dev-${digits}`;
  return {
    id,
    app_metadata: { provider: 'phone', role: 'rider' },
    user_metadata: { phone, full_name: `Rider ${digits.slice(-4)}` },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    phone,
    email: `phone_${digits}@dev.takememobility.com`,
    role: 'authenticated',
    confirmation_sent_at: undefined,
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    factors: [],
    identities: [],
  } as unknown as User;
}

function createDevSession(user: User): Session {
  return {
    access_token: `dev-token-${user.id}`,
    refresh_token: `dev-refresh-${user.id}`,
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    token_type: 'bearer',
    user,
  };
}

// --- Unconfigured provider (no env vars at all) ---
function UnconfiguredAuthProvider({ children }: { children: React.ReactNode }) {
  const noop = useCallback(
    async () => ({ success: false as const, error: 'Supabase not configured' }),
    [],
  );
  const value: AuthContextValue = useMemo(
    () => ({
      user: null, session: null, loading: false, initialized: true,
      sendOtp: noop, verifyOtp: noop, sendEmailOtp: noop, verifyEmailOtp: noop, signOut: async () => {},
    }),
    [noop],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// --- Dev provider: no network calls, 123456 always works ---
function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, session: null, loading: false, initialized: true,
  });

  const sendOtp = useCallback(async (phone: string) => {
    console.log(`[auth:dev] OTP "sent" to ${phone}. Use code: ${DEV_OTP}`);
    return { success: true as const };
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    if (code !== DEV_OTP) {
      return { success: false as const, error: `Wrong code. Enter ${DEV_OTP}` };
    }

    const user = createDevUser(phone);
    const session = createDevSession(user);
    console.log('[auth:dev] Signed in as:', user.id, user.email);
    setState({ user, session, loading: false, initialized: true });
    return { success: true as const };
  }, []);

  const sendEmailOtp = useCallback(async (email: string) => {
    console.log(`[auth:dev] Email OTP "sent" to ${email}. Use code: ${DEV_OTP}`);
    return { success: true as const };
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, code: string) => {
    if (code !== DEV_OTP) {
      return { success: false as const, error: `Wrong code. Enter ${DEV_OTP}` };
    }
    const digits = email.replace(/[^a-z0-9]/gi, '').slice(0, 8);
    const user = createDevUser(`email-${digits}`);
    user.email = email;
    const session = createDevSession(user);
    console.log('[auth:dev] Signed in via email as:', user.id, email);
    setState({ user, session, loading: false, initialized: true });
    return { success: true as const };
  }, []);

  const signOut = useCallback(async () => {
    console.log('[auth:dev] Signed out');
    setState({ user: null, session: null, loading: false, initialized: true });
  }, []);

  const value = useMemo(
    () => ({ ...state, sendOtp, verifyOtp, sendEmailOtp, verifyEmailOtp, signOut }),
    [state, sendOtp, verifyOtp, sendEmailOtp, verifyEmailOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// --- Production provider: real Supabase phone OTP ---
function ProductionAuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const [state, setState] = useState<AuthState>({
    user: null, session: null, loading: true, initialized: false,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null, session,
        loading: false, initialized: true,
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState((prev) => ({
          ...prev, user: session?.user ?? null, session, loading: false,
        }));
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const sendOtp = useCallback(async (phone: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) return { success: false as const, error: error.message };
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Failed' };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [supabase]);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const { data, error } = await supabase.auth.verifyOtp({
        phone, token: code, type: 'sms',
      });
      if (error) return { success: false as const, error: error.message };
      console.log('[auth] Verified, user:', data.user?.id);
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Failed' };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [supabase]);

  // Temporary email OTP fallback — remove once AWS SMS Production Access is approved
  const sendEmailOtp = useCallback(async (email: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) return { success: false as const, error: error.message };
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Failed' };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [supabase]);

  const verifyEmailOtp = useCallback(async (email: string, code: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const { data, error } = await supabase.auth.verifyOtp({
        email, token: code, type: 'email',
      });
      if (error) return { success: false as const, error: error.message };
      console.log('[auth] Verified via email, user:', data.user?.id);
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Failed' };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    await supabase.auth.signOut();
    setState({ user: null, session: null, loading: false, initialized: true });
  }, [supabase]);

  const value = useMemo(
    () => ({ ...state, sendOtp, verifyOtp, sendEmailOtp, verifyEmailOtp, signOut }),
    [state, sendOtp, verifyOtp, sendEmailOtp, verifyEmailOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// --- Router: picks the right provider based on config ---
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return <UnconfiguredAuthProvider>{children}</UnconfiguredAuthProvider>;
  }
  if (AUTH_MODE !== 'production') {
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }
  return <ProductionAuthProvider>{children}</ProductionAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
