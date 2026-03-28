'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

export default function SignupPage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signUp } = useAuth();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { error } = await signUp(formData.email, formData.password, formData.name);
      if (error) setError(error.message);
      else router.push('/dashboard');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full rounded-xl bg-surface-secondary px-4 py-3 text-[15px] font-medium text-ink placeholder-ink-tertiary outline-none transition-colors focus:bg-surface-tertiary focus:ring-1 focus:ring-ink/10";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Ride</h1>
          <p className="mt-2 text-sm text-ink-secondary">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-danger/8 px-4 py-3">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-danger" />
              <p className="text-sm font-medium text-ink">{error}</p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Full Name</label>
            <input name="name" value={formData.name} onChange={handleChange} required placeholder="Jane Smith" className={inputClasses} />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Email</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="you@example.com" className={inputClasses} />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Phone</label>
            <input name="phone" type="tel" value={formData.phone} onChange={handleChange} required placeholder="+1 (555) 000-0000" className={inputClasses} />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Password</label>
            <input name="password" type="password" value={formData.password} onChange={handleChange} required placeholder="Create a password" className={inputClasses} />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Confirm Password</label>
            <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required placeholder="Confirm your password" className={inputClasses} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-ink py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-ink-tertiary">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-ink hover:text-ink/70">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
