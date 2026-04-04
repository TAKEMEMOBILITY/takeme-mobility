import { useMemo } from 'react';

const AIRPORT_KEYWORDS = [
  'airport', 'sea-tac', 'seatac', "int'l", 'intl',
  'SEA ', 'boeing field', 'paine field',
  'seattle-tacoma', 'international airport',
];

function isAirportAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return AIRPORT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Detects if the current ride involves an airport based on pickup/dropoff text.
 * Returns isAirport boolean and which end is the airport.
 */
export function useAirportDetection(
  pickupLabel: string,
  dropoffLabel: string,
) {
  return useMemo(() => {
    const pickupIsAirport = isAirportAddress(pickupLabel);
    const dropoffIsAirport = isAirportAddress(dropoffLabel);
    const isAirport = pickupIsAirport || dropoffIsAirport;

    return {
      isAirport,
      pickupIsAirport,
      dropoffIsAirport,
      /** 'pickup' if going FROM airport, 'dropoff' if going TO airport */
      airportEnd: pickupIsAirport ? 'pickup' as const : dropoffIsAirport ? 'dropoff' as const : null,
    };
  }, [pickupLabel, dropoffLabel]);
}
