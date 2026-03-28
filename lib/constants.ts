export const RIDE_TYPES = [
  {
    id: 'economy',
    name: 'Economy',
    description: '4 seats',
    basePrice: 1.5,
    perMilePrice: 0.75,
    perMinutePrice: 0.25,
    minFare: 8.5,
  },
  {
    id: 'comfort',
    name: 'Comfort',
    description: '4 seats',
    basePrice: 2.5,
    perMilePrice: 1.25,
    perMinutePrice: 0.35,
    minFare: 12.0,
  },
  {
    id: 'premium',
    name: 'Premium',
    description: '4 seats',
    basePrice: 4.0,
    perMilePrice: 2.0,
    perMinutePrice: 0.5,
    minFare: 18.0,
  },
];

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
