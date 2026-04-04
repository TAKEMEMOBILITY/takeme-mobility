export * from './ride-status';
export * from './pricing';

/** Dispatch configuration (mirrors server-side) */
export const DISPATCH = {
  SEARCH_RADII_M: [3000, 5000, 10000],
  LOCATION_FRESHNESS_MIN: 5,
  MAX_RESULTS_PER_RADIUS: 10,
  ACCEPT_TIMEOUT_SEC: 30,
  MAX_RETRY_ATTEMPTS: 3,
} as const;

/** Driver location broadcast interval */
export const DRIVER_LOCATION_INTERVAL_MS = 5000;

/** Minimum time between location updates sent to server */
export const LOCATION_THROTTLE_MS = 3000;

/** Seattle center coordinates (default map region) */
export const SEATTLE_CENTER = {
  latitude: 47.6062,
  longitude: -122.3321,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
} as const;
