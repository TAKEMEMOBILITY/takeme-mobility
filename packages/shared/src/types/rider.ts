export interface Rider {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  avatar_url: string | null;
  rating: number;
  total_rides: number;
  stripe_customer_id: string | null;
  default_payment_method: string | null;
  created_at: string;
  updated_at: string;
}
