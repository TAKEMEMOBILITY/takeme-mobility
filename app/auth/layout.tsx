import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ride - Book Your Ride',
  description: 'Professional rideshare service',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
