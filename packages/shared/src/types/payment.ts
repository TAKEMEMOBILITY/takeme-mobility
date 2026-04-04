export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'disputed';

export type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay';

export interface Payment {
  id: string;
  ride_id: string;
  rider_id: string;
  stripe_payment_intent: string;
  stripe_charge_id: string | null;
  payment_method_type: PaymentMethodType;
  amount: number;
  currency: string;
  status: PaymentStatus;
  authorized_at: string | null;
  captured_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  failure_reason: string | null;
}
