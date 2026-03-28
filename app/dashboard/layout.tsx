import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard - Ride',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
