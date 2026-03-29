// ═══════════════════════════════════════════════════════════════════════════
// Stripe Issuing — TAKEME Card operations
// Creates cardholders, virtual cards, and physical cards via REST API.
// ═══════════════════════════════════════════════════════════════════════════

const STRIPE_API = 'https://api.stripe.com/v1';

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

export async function createVirtualCard(cardholderId: string, userId: string): Promise<{
  id: string;
  last4: string;
  status: string;
}> {
  const data = await post('/issuing/cards', {
    'cardholder': cardholderId,
    'currency': 'usd',
    'type': 'virtual',
    'status': 'active',
    'spending_controls[allowed_categories][]': 'all',
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

// ── Fund card (add balance via top-up or test helper) ────────────────────

export async function fundTestCard(cardId: string, amount: number): Promise<void> {
  await post('/test_helpers/issuing/cards/' + cardId + '/shipping/deliver', {});
}
