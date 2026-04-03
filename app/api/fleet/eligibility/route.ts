import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkDriverEligibility } from '@/lib/fleet/eligibility';

// GET — check driver eligibility for a vehicle
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const vehicleId = url.searchParams.get('vehicleId');
  if (!vehicleId) return NextResponse.json({ error: 'Missing vehicleId' }, { status: 400 });

  const result = await checkDriverEligibility(user.id, vehicleId);
  return NextResponse.json(result);
}
