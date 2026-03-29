import { redirect } from 'next/navigation';

// Unified auth — signup and login are the same phone OTP flow
export default function SignupPage() {
  redirect('/auth/login');
}
