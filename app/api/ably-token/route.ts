import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAblyToken } from '@/lib/ably';

// GET /api/ably-token — Issue Ably token for authenticated users
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = await createAblyToken(user.id);
    return NextResponse.json({ token });
  } catch (err) {
    console.error('[ably-token]', err);
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
}
