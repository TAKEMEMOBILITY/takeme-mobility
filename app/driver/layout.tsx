import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'TakeMe Driver',
  description: 'TakeMe Mobility — Driver App',
  manifest: '/driver-manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#1D1D1F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
