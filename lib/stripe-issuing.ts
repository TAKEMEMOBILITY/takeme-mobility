// ═══════════════════════════════════════════════════════════════════════════
// Stripe Issuing — TAKEME Card operations
// Creates cardholders, virtual cards, and physical cards via REST API.
//
// Feature flag: Set STRIPE_ISSUING_ENABLED=true to enable.
// When disabled, all functions return mock data without hitting Stripe.
// ═══════════════════════════════════════════════════════════════════════════

const STRIPE_API = 'https://api.stripe.com/v1';

export function isIssuingEnabled(): boolean {
  return process.env.STRIPE_ISSUING_ENABLED === 'true';
}

function getKey(): string {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return key;
}

async function post(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || `Stripe error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function get(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { 'Authorization': `Bearer ${getKey()}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || `Stripe error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ── Cardholder ───────────────────────────────────────────────────────────

export async function createCardholder(params: {
  name: string;
  email: string;
  phone: string;
  userId: string;
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): Promise<{ id: string; status: string }> {
  if (!isIssuingEnabled()) {
    console.log('[stripe-issuing] Feature disabled — returning mock cardholder');
    return { id: `ich_mock_${params.userId.slice(0, 8)}`, status: 'active' };
  }
  const body: Record<string, string> = {
    'name': params.name,
    'email': params.email,
    'phone_number': params.phone,
    'type': 'individual',
    'status': 'active',
    'billing[address][line1]': params.line1 || '1 TakeMe Way',
    'billing[address][city]': params.city || 'Seattle',
    'billing[address][state]': params.state || 'WA',
    'billing[address][postal_code]': params.postalCode || '98101',
    'billing[address][country]': params.country || 'US',
    'metadata[user_id]': params.userId,
    'metadata[platform]': 'takeme',
  };

  const data = await post('/issuing/cardholders', body);
  return { id: data.id as string, status: data.status as string };
}

// ── Virtual card ─────────────────────────────────────────────────────────

// Default spending limits for driver cards
const DRIVER_SPENDING_LIMITS = {
  dailyLimit: 50000,   // $500/day in cents
  monthlyLimit: 500000, // $5,000/month in cents
  perTransaction: 20000, // $200 per transaction in cents
};

export async function createVirtualCard(cardholderId: string, userId: string, options?: {
  dailyLimit?: number;
  monthlyLimit?: number;
  perTransaction?: number;
}): Promise<{
  id: string;
  last4: string;
  status: string;
}> {
  if (!isIssuingEnabled()) {
    console.log('[stripe-issuing] Feature disabled — returning mock virtual card');
    return { id: `ic_mock_v_${userId.slice(0, 8)}`, last4: '0000', status: 'active' };
  }

  const daily = options?.dailyLimit ?? DRIVER_SPENDING_LIMITS.dailyLimit;
  const monthly = options?.monthlyLimit ?? DRIVER_SPENDING_LIMITS.monthlyLimit;
  const perTx = options?.perTransaction ?? DRIVER_SPENDING_LIMITS.perTransaction;

  const data = await post('/issuing/cards', {
    'cardholder': cardholderId,
    'currency': 'usd',
    'type': 'virtual',
    'status': 'active',
    'spending_controls[spending_limits][0][amount]': String(daily),
    'spending_controls[spending_limits][0][interval]': 'daily',
    'spending_controls[spending_limits][1][amount]': String(monthly),
    'spending_controls[spending_limits][1][interval]': 'monthly',
    'spending_controls[spending_limits][2][amount]': String(perTx),
    'spending_controls[spending_limits][2][interval]': 'per_authorization',
    'metadata[user_id]': userId,
    'metadata[card_type]': 'takeme_virtual',
  });

  return {
    id: data.id as string,
    last4: data.last4 as string,
    status: data.status as string,
  };
}

// ── Physical card ────────────────────────────────────────────────────────

export async function createPhysicalCard(cardholderId: string, userId: string, shipping: {
  name: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
}): Promise<{
  id: string;
  last4: string;
  status: string;
}> {
  if (!isIssuingEnabled()) {
    console.log('[stripe-issuing] Feature disabled — returning mock physical card');
    return { id: `ic_mock_p_${userId.slice(0, 8)}`, last4: '0000', status: 'inactive' };
  }

  const data = await post('/issuing/cards', {
    'cardholder': cardholderId,
    'currency': 'usd',
    'type': 'physical',
    'status': 'inactive',
    'shipping[name]': shipping.name,
    'shipping[address][line1]': shipping.line1,
    'shipping[address][city]': shipping.city,
    'shipping[address][state]': shipping.state,
    'shipping[address][postal_code]': shipping.postalCode,
    'shipping[address][country]': 'US',
    'shipping[service]': 'standard',
    'metadata[user_id]': userId,
    'metadata[card_type]': 'takeme_physical',
  });

  return {
    id: data.id as string,
    last4: data.last4 as string,
    status: data.status as string,
  };
}

// ── Card status ──────────────────────────────────────────────────────────

export async function getCardDetails(cardId: string): Promise<{
  id: string;
  last4: string;
  status: string;
  type: string;
  shipping?: { status: string };
}> {
  const data = await get(`/issuing/cards/${cardId}`);
  return {
    id: data.id as string,
    last4: data.last4 as string,
    status: data.status as string,
    type: data.type as string,
    shipping: data.shipping as { status: string } | undefined,
  };
}

// ── Top-up Issuing balance ────────────────────────────────────────────────
// In production, Stripe Issuing cards draw from the Issuing balance.
// Top-ups move funds from your Stripe balance → Issuing balance.

export async function createTopUp(amountCents: number, description: string): Promise<{
  id: string;
  amount: number;
  status: string;
}> {
  const data = await post('/topups', {
    'amount': String(amountCents),
    'currency': 'usd',
    'description': description,
    'destination_balance': 'issuing',
  });
  return {
    id: data.id as string,
    amount: data.amount as number,
    status: data.status as string,
  };
}

// ── Test mode: fund a card directly (test helpers only) ──────────────────

export async function testFundCard(amount: number): Promise<{ id: string }> {
  // In test mode, create a test top-up to the Issuing balance
  const data = await post('/test_helpers/issuing/fund_balance', {
    'amount': String(amount),
    'currency': 'usd',
  });
  return { id: data.id as string };
}
