'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import type { AuthError, User } from '@supabase/supabase-js';
import { useAuth as useAuthHook } from '@/lib/supabase/hooks';

type AuthResult = Promise<{ data: { user: User | null } | null; error: AuthError | null }>;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => AuthResult;
  signIn: (email: string, password: string) => AuthResult;
  signOut: () => Promise<{ error: AuthError | null }>;
}

// Default value — used when context is missing. Never throws.
const defaultAuth: AuthContextType = {
  user: null,
  loading: false,
  signUp: async () => ({ data: null, error: null }),
  signIn: async () => ({ data: null, error: null }),
  signOut: async () => ({ error: null }),
};

const AuthContext = createContext<AuthContextType>(defaultAuth);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthHook();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
