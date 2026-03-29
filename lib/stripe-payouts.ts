// ═══════════════════════════════════════════════════════════════════════════
// Stripe Connect — Driver Payouts
// Handles instant payouts to driver bank accounts or debit cards.
// For TAKEME Card payouts, funds go to the Issuing balance instead.
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
    throw new Error((data as { error?: { message?: string } })?.error?.message || `Stripe error ${res.status}`);
  }
  return data;
}

/**
 * Create a payout to a Connected account's external account (bank/debit).
 * Requires the driver to have a Stripe Connect account.
 */
export async function createPayout(params: {
  stripeAccountId: string;
  amount: number;       // cents
  method: 'standard' | 'instant';
  description?: string;
}): Promise<{ id: string; status: string; arrival_date: number }> {
  const body: Record<string, string> = {
    'amount': String(params.amount),
    'currency': 'usd',
    'method': params.method,
  };
  if (params.description) body['description'] = params.description;

  const data = await post(`/payouts?stripe_account=${params.stripeAccountId}`, body);
  return {
    id: data.id as string,
    status: data.status as string,
    arrival_date: data.arrival_date as number,
  };
}

/**
 * Transfer from platform to a Connected account (precedes payout).
 */
export async function createTransfer(params: {
  stripeAccountId: string;
  amount: number;       // cents
  description?: string;
}): Promise<{ id: string }> {
  const body: Record<string, string> = {
    'amount': String(params.amount),
    'currency': 'usd',
    'destination': params.stripeAccountId,
  };
  if (params.description) body['description'] = params.description;

  const data = await post('/transfers', body);
  return { id: data.id as string };
}
