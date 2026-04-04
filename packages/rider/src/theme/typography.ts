import { Platform, TextStyle } from 'react-native';

/**
 * Takeme Premium Typography
 *
 * System font with tight letter-spacing for a modern, high-end feel.
 * SF Pro (iOS) / Roboto (Android) at carefully tuned weights.
 */
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  /** Hero headlines — welcome/onboarding */
  hero: {
    fontFamily,
    fontSize: 42,
    fontWeight: '700',
    lineHeight: 46,
    letterSpacing: -1.2,
  } as TextStyle,

  /** Large screen titles */
  h1: {
    fontFamily,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.8,
  } as TextStyle,

  /** Section headings */
  h2: {
    fontFamily,
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 32,
    letterSpacing: -0.5,
  } as TextStyle,

  /** Card titles, sub-section headings */
  h3: {
    fontFamily,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: -0.3,
  } as TextStyle,

  /** Primary body text */
  body: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: -0.1,
  } as TextStyle,

  /** Emphasized body */
  bodyMedium: {
    fontFamily,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.1,
  } as TextStyle,

  /** Secondary text, descriptions */
  caption: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0,
  } as TextStyle,

  /** Labels, badges */
  captionMedium: {
    fontFamily,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0,
  } as TextStyle,

  /** Fine print, metadata */
  small: {
    fontFamily,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.1,
  } as TextStyle,

  /** Overline labels (uppercased in usage) */
  overline: {
    fontFamily,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 1.2,
  } as TextStyle,

  /** Button labels */
  button: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: 0.1,
  } as TextStyle,

  /** Large button / CTA labels */
  buttonLg: {
    fontFamily,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0.1,
  } as TextStyle,

  /** Numeric displays (fares, timers) */
  numeric: {
    fontFamily,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  } as TextStyle,

  /** Large numeric (hero fare) */
  numericLg: {
    fontFamily,
    fontSize: 44,
    fontWeight: '700',
    lineHeight: 50,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
} as const;
