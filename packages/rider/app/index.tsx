import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { isSupabaseConfigured } from '@/providers/supabase';

export default function Index() {
  // Skip auth check when Supabase isn't configured (EnvMissing screen handles it)
  if (!isSupabaseConfigured) {
    return <Redirect href="/(auth)/welcome" />;
  }

  const { user, initialized } = useAuth();

  // Wait for session restore before deciding
  if (!initialized) return null;

  // Authenticated → go straight to home (no flash through welcome)
  if (user) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
