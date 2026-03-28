import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TakeMe Driver',
  description: 'TakeMe Mobility — Driver App',
  manifest: '/driver-manifest.json',
  themeColor: '#1D1D1F',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
