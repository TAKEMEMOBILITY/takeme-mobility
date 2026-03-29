'use client';

import React, { createContext, useContext, useState, type ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// AuthContext — hardcoded stub. Zero Supabase. Zero SDK.
// This isolates whether the crash is from Supabase client init.
// ═══════════════════════════════════════════════════════════════════════════

interface AuthContextType {
  user: { id: string; email?: string } | null;
  loading: boolean;
  signUp: (...args: unknown[]) => Promise<{ data: null; error: { message: string } | null }>;
  signIn: (...args: unknown[]) => Promise<{ data: null; error: { message: string } | null }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
}

const noop = async (..._args: unknown[]) => ({ data: null, error: null as { message: string } | null });

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  signUp: noop,
  signIn: noop,
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading] = useState(false);

  return (
    <AuthContext.Provider value={{
      user: null,
      loading,
      signUp: noop,
      signIn: noop,
      signOut: async () => ({ error: null as { message: string } | null }),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
