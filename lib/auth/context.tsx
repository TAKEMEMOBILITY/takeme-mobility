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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthHook();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
