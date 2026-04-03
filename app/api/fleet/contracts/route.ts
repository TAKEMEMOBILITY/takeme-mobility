import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createContract, signContract } from '@/lib/fleet/contracts';

// POST — create a contract
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const result = await createContract({
    type: body.type,
    ownerId: body.ownerId,
    vehicleId: body.vehicleId,
    driverId: body.driverId,
    bookingId: body.bookingId,
    variables: body.variables ?? {},
    signerEmails: body.signers ?? [],
  });

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ contractId: result.contractId });
}

// GET — get contract details
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const contractId = url.searchParams.get('id');
  if (!contractId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const svc = createServiceClient();
  const [contract, signers, events] = await Promise.all([
    svc.from('contracts').select('*').eq('id', contractId).single(),
    svc.from('contract_signers').select('*').eq('contract_id', contractId),
    svc.from('contract_signature_events').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }),
  ]);

  if (!contract.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ contract: contract.data, signers: signers.data ?? [], events: events.data ?? [] });
}

// PUT — sign a contract
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';

  const result = await signContract(
    (await request.json()).contractId,
    user.email ?? '',
    ip,
    ua,
  );

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ signed: true, executed: result.executed });
}
