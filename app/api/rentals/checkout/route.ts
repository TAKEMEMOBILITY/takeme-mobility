import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const STRIPE_API = 'https://api.stripe.com/v1';

function getStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key || key.includes('PASTE_YOUR')) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return key;
}

function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TM-${code}`;
}

interface Addon {
  name: string;
  pricePerDay: number;
}

interface CheckoutBody {
  vehicleKey: string;
  vehicleName: string;
  category: string;
  dailyRate: number;
  pickupDate: string;
  returnDate: string;
  pickupLocation: string;
  addons?: Addon[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let rentalId: string | null = null;
  const svc = createServiceClient();

  try {
    const body: CheckoutBody = await request.json();

    // Validate required fields
    const { vehicleKey, vehicleName, category, dailyRate, pickupDate, returnDate, pickupLocation } = body;
    const addons: Addon[] = body.addons ?? [];

    if (!vehicleKey || !vehicleName || !category || !dailyRate || !pickupDate || !returnDate || !pickupLocation) {
      return NextResponse.json(
        { error: 'Missing required fields: vehicleKey, vehicleName, category, dailyRate, pickupDate, returnDate, pickupLocation' },
        { status: 400 },
      );
    }

    if (dailyRate <= 0) {
      return NextResponse.json({ error: 'dailyRate must be positive' }, { status: 400 });
    }

    // Calculate dates and totals
    const pickup = new Date(pickupDate);
    const returnD = new Date(returnDate);
    if (isNaN(pickup.getTime()) || isNaN(returnD.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const diffMs = returnD.getTime() - pickup.getTime();
    const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (totalDays < 1) {
      return NextResponse.json({ error: 'Return date must be after pickup date' }, { status: 400 });
    }

    const subtotal = dailyRate * totalDays;
    const addonsTotal = addons.reduce((sum, a) => sum + (a.pricePerDay * totalDays), 0);
    const totalAmount = subtotal + addonsTotal;
    const currency = 'usd';
    const confirmationCode = generateConfirmationCode();

    // Insert rental record
    const { data: rental, error: insertError } = await svc
      .from('rentals')
      .insert({
        user_id: user.id,
        vehicle_key: vehicleKey,
        vehicle_name: vehicleName,
        category,
        daily_rate: dailyRate,
        total_days: totalDays,
        subtotal,
        addons: addons.length > 0 ? addons : null,
        addons_total: addonsTotal,
        total_amount: totalAmount,
        currency,
        pickup_date: pickupDate,
        return_date: returnDate,
        pickup_location: pickupLocation,
        status: 'pending',
        confirmation_code: confirmationCode,
      })
      .select('id')
      .single();

    if (insertError || !rental) {
      console.error('[rentals/checkout] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create rental' }, { status: 500 });
    }

    rentalId = rental.id;
    const rentalIdStr: string = rental.id;

    // Create Stripe PaymentIntent
    const amountCents = Math.round(totalAmount * 100);
    const stripeKey = getStripeKey();

    const piParams = new URLSearchParams({
      'amount': String(amountCents),
      'currency': currency,
      'automatic_payment_methods[enabled]': 'true',
      'metadata[rental_id]': rentalIdStr,
      'metadata[confirmation_code]': confirmationCode,
      'metadata[platform]': 'takeme',
      'metadata[user_id]': user.id,
      'description': `TakeMe EV Rental: ${vehicleName} (${totalDays} days)`,
    });

    const piRes = await fetch(`${STRIPE_API}/payment_intents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `rental_pi_${rentalIdStr}`,
      },
      body: piParams.toString(),
    });

    const piData = await piRes.json();
    if (!piRes.ok) {
      const msg = piData?.error?.message || `Stripe error ${piRes.status}`;
      throw new Error(msg);
    }

    // Update rental with Stripe payment intent ID
    const { error: updateError } = await svc
      .from('rentals')
      .update({
        stripe_payment_intent: piData.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rentalId);

    if (updateError) {
      console.error('[rentals/checkout] Update error:', updateError);
      throw new Error('Failed to link payment intent to rental');
    }

    return NextResponse.json({
      rentalId,
      clientSecret: piData.client_secret,
      confirmationCode,
    });
  } catch (err) {
    console.error('[rentals/checkout]', err);

    // Clean up the rental record on failure
    if (rentalId) {
      await svc.from('rentals').delete().eq('id', rentalId);
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout failed' },
      { status: 500 },
    );
  }
}
