'use client';

import { useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// useRetry — Frontend retry hook with exponential backoff
//
// Max 3 retries. Backoff: 1s, 2s, 4s.
// After 3 failures → permanent error with support link.
// Logs each retry attempt.
// ═══════════════════════════════════════════════════════════════════════════

interface RetryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  retryCount: number;
  canRetry: boolean;
  exhausted: boolean;
  execute: () => Promise<void>;
}

const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

export function useRetry<T>(
  fn: () => Promise<T>,
  options?: { onExhausted?: () => void },
): RetryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const exhausted = retryCount >= MAX_RETRIES && error !== null;
  const canRetry = retryCount < MAX_RETRIES;

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Log retry
    if (retryCount > 0) {
      fetch('/api/security/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'USER_RETRY', retryCount }),
      }).catch(() => {});
    }

    // Wait for backoff if retrying
    if (retryCount > 0) {
      const delay = BACKOFF_MS[Math.min(retryCount - 1, BACKOFF_MS.length - 1)];
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const result = await fn();
      setData(result);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setRetryCount(c => {
        const next = c + 1;
        if (next >= MAX_RETRIES && options?.onExhausted) {
          options.onExhausted();
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [fn, retryCount, options]);

  return { data, error, loading, retryCount, canRetry, exhausted, execute };
}
