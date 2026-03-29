'use client';

import { Component, type ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/context';

// ═══════════════════════════════════════════════════════════════════════════
// Client-side error boundary + auth provider wrapper.
// Catches any runtime crash inside the React tree and shows a
// user-friendly recovery UI instead of a blank screen.
// ═══════════════════════════════════════════════════════════════════════════

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Log full details for debugging
    console.error('[TakeMe] Runtime crash:', error.message);
    console.error('[TakeMe] Stack:', error.stack);
    if (info.componentStack) {
      console.error('[TakeMe] Component tree:', info.componentStack);
    }
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
          <div style={{ textAlign: 'center', maxWidth: '420px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#F5F5F7',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <p style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
              Something went wrong
            </p>
            <p style={{ fontSize: '14px', color: '#86868B', marginTop: '8px', lineHeight: 1.6 }}>
              We couldn't load the page. This is usually temporary.
            </p>
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                }}
                style={{
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
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 28px',
                  background: '#fff',
                  color: '#1D1D1F',
                  border: '1px solid #E8E8ED',
                  borderRadius: '999px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ErrorBoundary>
  );
}
