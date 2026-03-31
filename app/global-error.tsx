'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Next.js App Router global error boundary.
// Catches errors in root layout and all pages.
// Reports to Sentry for observability.
// ═══════════════════════════════════════════════════════════════════════════

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
          color: '#1D1D1F',
          padding: '2rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '440px' }}>
            {/* Icon */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#F5F5F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '15px', color: '#86868B', marginTop: '8px', lineHeight: 1.6 }}>
              We're having trouble loading this page.
              This is usually temporary — please try again.
            </p>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  padding: '12px 28px',
                  background: '#1D1D1F',
                  color: '#FFFFFF',
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
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '12px 28px',
                  background: '#FFFFFF',
                  color: '#1D1D1F',
                  border: '1px solid #E8E8ED',
                  borderRadius: '999px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Go home
              </button>
            </div>

            {/* Error details — only in dev */}
            {process.env.NODE_ENV === 'development' && error?.message && (
              <pre style={{
                marginTop: '32px',
                padding: '12px 16px',
                background: '#F5F5F7',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#86868B',
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: '120px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
