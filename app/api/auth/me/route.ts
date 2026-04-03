import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/auth/me — Returns current user info for client-side components
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ email: null, role: null }, { status: 401 });
  }

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from('riders')
    .select('role')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    email: user.email ?? '',
    role: profile?.role ?? 'user',
    userId: user.id,
  });
}
