/**
 * Takeme Premium Spacing
 *
 * 8px base grid. Generous spacing for luxury feel.
 * Every value is a multiple of 4 or 8.
 */
export const spacing = {
  /** 4px — hairline gaps */
  xs: 4,
  /** 8px — tight internal padding */
  sm: 8,
  /** 12px — compact gaps */
  md: 12,
  /** 16px — standard padding */
  lg: 16,
  /** 20px — comfortable gaps */
  xl: 20,
  /** 24px — section padding */
  '2xl': 24,
  /** 32px — generous section gaps */
  '3xl': 32,
  /** 40px — screen vertical padding */
  '4xl': 40,
  /** 48px — hero spacing */
  '5xl': 48,
  /** 64px — dramatic spacing */
  '6xl': 64,
  /** 80px — ultra spacing (onboarding) */
  '7xl': 80,
  /** Screen horizontal padding */
  screen: 24,
} as const;

export const radius = {
  /** 8px — subtle */
  sm: 8,
  /** 12px — standard cards/inputs */
  md: 12,
  /** 16px — elevated cards */
  lg: 16,
  /** 20px — bottom sheets */
  xl: 20,
  /** 24px — hero cards */
  '2xl': 24,
  /** Full circle */
  full: 9999,
} as const;

export const shadow = {
  /** Subtle card elevation */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  /** Standard card */
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  /** Elevated sheet */
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  /** Modal overlay */
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;
