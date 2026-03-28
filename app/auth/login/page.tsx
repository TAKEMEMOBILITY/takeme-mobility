'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
      else router.push('/dashboard');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Ride</h1>
          <p className="mt-2 text-sm text-ink-secondary">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-danger/8 px-4 py-3">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-danger" />
              <p className="text-sm font-medium text-ink">{error}</p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-surface-secondary px-4 py-3 text-[15px] font-medium text-ink placeholder-ink-tertiary outline-none transition-colors focus:bg-surface-tertiary focus:ring-1 focus:ring-ink/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl bg-surface-secondary px-4 py-3 text-[15px] font-medium text-ink placeholder-ink-tertiary outline-none transition-colors focus:bg-surface-tertiary focus:ring-1 focus:ring-ink/10"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-ink py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-ink-tertiary">
          New here?{' '}
          <Link href="/auth/signup" className="font-semibold text-ink hover:text-ink/70">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
