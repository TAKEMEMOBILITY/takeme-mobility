import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextResponse } from 'next/server';

/**
 * Verify the current request is from an admin user.
 * Returns the user if admin, or a 403 response.
 */
export async function requireAdmin(): Promise<
  { user: { id: string; email: string }; error: null } |
  { user: null; error: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const svc = createServiceClient();
  const { data: rider } = await svc
    .from('riders')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!rider?.is_admin) {
    return { user: null, error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return { user: { id: user.id, email: user.email ?? '' }, error: null };
}
