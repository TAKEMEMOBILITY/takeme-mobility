'use client';

import { GoogleMapsProvider } from './GoogleMapsProvider';
import HeroBooking from './HeroBooking';

export default function HeroBookingWrapper({ ctaHref }: { ctaHref: string }) {
  return (
    <GoogleMapsProvider>
      <HeroBooking ctaHref={ctaHref} />
    </GoogleMapsProvider>
  );
}
