'use client';

import { Component, type ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/context';

// ── Global error boundary — catches ANY client crash ─────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[TakeMe] Client crash caught by error boundary:', error);
    console.error('[TakeMe] Component stack:', info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#fff',
          color: '#1D1D1F',
          padding: '2rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <p style={{ fontSize: '18px', fontWeight: 600 }}>Something went wrong</p>
            <p style={{ fontSize: '14px', color: '#86868B', marginTop: '8px' }}>
              Please refresh the page or try again later.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '20px',
                padding: '12px 28px',
                background: '#1D1D1F',
                color: '#fff',
                border: 'none',
                borderRadius: '999px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ── Provider wrapper ─────────────────────────────────────────────────────

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ErrorBoundary>
  );
}
