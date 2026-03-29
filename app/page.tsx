'use client';

import { useAuth } from '@/lib/auth/context';

export default function Page() {
  const { user, loading } = useAuth();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#1D1D1F' }}>App is alive</p>
        <p style={{ fontSize: '14px', color: '#86868B', marginTop: '8px' }}>
          Auth: {loading ? 'loading...' : user ? user.email : 'not signed in'}
        </p>
      </div>
    </div>
  );
}
