import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { ApiClient, API } from '@takeme/shared';
import { useSupabase } from './supabase';

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
const AUTH_MODE = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'dev';

// ---------------------------------------------------------------------------
// Dev helpers
// ---------------------------------------------------------------------------
function createDevUser(phone: string): User {
  const digits = phone.replace(/\D/g, '');
  const id = `dev-driver-${digits}`;
  return {
    id,
    app_metadata: { provider: 'phone', role: 'driver' },
    user_metadata: { phone, full_name: `Driver ${digits.slice(-4)}` },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    phone,
    email: `driver_${digits}@dev.takememobility.com`,
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

// ---------------------------------------------------------------------------
// Dev auth provider — no network calls, code 123456 always works
// ---------------------------------------------------------------------------
function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, session: null, loading: false, initialized: true,
  });

  const sendOtp = useCallback(async (phone: string) => {
    console.log(`[auth:dev:driver] OTP "sent" to ${phone}. Use code: ${DEV_OTP}`);
    return { success: true };
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    if (code !== DEV_OTP) {
      return { success: false, error: `Wrong code. Enter ${DEV_OTP}` };
    }
    const user = createDevUser(phone);
    const session = createDevSession(user);
    console.log('[auth:dev:driver] Signed in as:', user.id);
    setState({ user, session, loading: false, initialized: true });
    return { success: true };
  }, []);

  const sendEmailOtp = useCallback(async (email: string) => {
    console.log(`[auth:dev:driver] Email OTP "sent" to ${email}. Use code: ${DEV_OTP}`);
    return { success: true };
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, code: string) => {
    if (code !== DEV_OTP) {
      return { success: false, error: `Wrong code. Enter ${DEV_OTP}` };
    }
    const digits = email.replace(/[^a-z0-9]/gi, '').slice(0, 8);
    const user = createDevUser(`email-${digits}`);
    user.email = email;
    const session = createDevSession(user);
    console.log('[auth:dev:driver] Signed in via email as:', user.id, email);
    setState({ user, session, loading: false, initialized: true });
    return { success: true };
  }, []);

  const signOut = useCallback(async () => {
    console.log('[auth:dev:driver] Signed out');
    setState({ user: null, session: null, loading: false, initialized: true });
  }, []);

  const value = useMemo(
    () => ({ ...state, sendOtp, verifyOtp, sendEmailOtp, verifyEmailOtp, signOut }),
    [state, sendOtp, verifyOtp, sendEmailOtp, verifyEmailOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Production auth provider — real OTP via API server
// ---------------------------------------------------------------------------
function ProductionAuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false,
  });

  const apiClient = useMemo(
    () =>
      new ApiClient({
        baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL!,
        getAccessToken: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        },
      }),
    [supabase],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        initialized: true,
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState((prev) => ({
          ...prev,
          user: session?.user ?? null,
          session,
          loading: false,
        }));
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const sendOtp = useCallback(
    async (phone: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true }));
        await apiClient.post(API.AUTH_SEND_OTP, { phone });
        return { success: true };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to send OTP';
        return { success: false, error: message };
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [apiClient],
  );

  const verifyOtp = useCallback(
    async (phone: string, code: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true }));
        const result = await apiClient.post<{
          access_token: string;
          refresh_token: string;
        }>(API.AUTH_VERIFY_OTP, { phone, code });

        const { error } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });

        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to verify OTP';
        return { success: false, error: message };
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [apiClient, supabase],
  );

  // Temporary email OTP fallback via direct Supabase — remove once AWS SMS Production Access is approved
  const sendEmailOtp = useCallback(
    async (email: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true }));
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to send email OTP';
        return { success: false, error: message };
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [supabase],
  );

  const verifyEmailOtp = useCallback(
    async (email: string, code: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true }));
        const { data, error } = await supabase.auth.verifyOtp({
          email, token: code, type: 'email',
        });
        if (error) return { success: false, error: error.message };
        console.log('[auth:driver] Verified via email, user:', data.user?.id);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to verify email OTP';
        return { success: false, error: message };
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      loading: false,
      initialized: true,
    });
  }, [supabase]);

  const value = useMemo(
    () => ({ ...state, sendOtp, verifyOtp, sendEmailOtp, verifyEmailOtp, signOut }),
    [state, sendOtp, verifyOtp, sendEmailOtp, verifyEmailOtp, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Router: picks dev or production based on EXPO_PUBLIC_AUTH_MODE
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (AUTH_MODE !== 'production') {
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }
  return <ProductionAuthProvider>{children}</ProductionAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
