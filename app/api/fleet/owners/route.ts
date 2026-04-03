import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getOnboardingProgress } from '@/lib/fleet/onboarding';

// POST — register as fleet owner
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();

  // Check if already registered
  const { data: existing } = await svc.from('fleet_owners').select('id').eq('auth_user_id', user.id).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ ownerId: existing[0].id, existing: true });
  }

  const body = await request.json();
  const { data: owner, error } = await svc.from('fleet_owners').insert({
    auth_user_id: user.id,
    email: user.email ?? body.email,
    phone: body.phone ?? null,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create empty profile
  await svc.from('fleet_owner_profiles').insert({ owner_id: owner!.id, full_name: body.fullName ?? '' });
  // Create empty KYC
  await svc.from('fleet_owner_kyc').insert({ owner_id: owner!.id });

  return NextResponse.json({ ownerId: owner!.id });
}

// GET — get onboarding progress
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: owner } = await svc.from('fleet_owners').select('id').eq('auth_user_id', user.id).single();
  if (!owner) return NextResponse.json({ error: 'Not a fleet owner' }, { status: 404 });

  const progress = await getOnboardingProgress(owner.id);
  return NextResponse.json({ ownerId: owner.id, ...progress });
}
