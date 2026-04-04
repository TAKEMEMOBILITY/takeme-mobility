/**
 * Takeme — Premium Design System
 *
 * Visual DNA: Tesla × Waymo × Apple
 * Palette: Deep black, pure white, warm neutrals, restrained blue accent
 * Premium warmth via subtle champagne/gold touches on CTAs
 */
export const colors = {
  // ── Core ──
  black: '#000000',
  white: '#FFFFFF',

  // ── Brand ──
  brand: '#0A0A0A',        // near-black hero backgrounds
  brandSoft: '#141414',    // elevated dark surfaces
  accent: '#2563EB',       // restrained blue — links, focus rings only
  accentSoft: 'rgba(37, 99, 235, 0.08)', // blue tint for selections

  // ── Premium Metallic ──
  gold: '#C9A96E',         // warm champagne for primary CTAs
  goldLight: '#D4BA82',    // hover / active state
  goldSoft: 'rgba(201, 169, 110, 0.10)', // gold tint backgrounds

  // ── Neutrals (warm undertone) ──
  gray50: '#FAFAF9',       // lightest surface
  gray100: '#F5F5F4',      // card backgrounds
  gray150: '#EEEEEC',      // input backgrounds
  gray200: '#E7E5E4',      // borders
  gray300: '#D6D3D1',      // disabled borders
  gray400: '#A8A29E',      // placeholder text
  gray500: '#78716C',      // secondary text
  gray600: '#57534E',      // body text
  gray700: '#44403C',      // strong secondary
  gray800: '#292524',      // headings on light
  gray900: '#1C1917',      // primary text

  // ── Semantic ──
  success: '#34c759',
  successSoft: 'rgba(52, 199, 89, 0.08)',
  error: '#ff3b30',
  errorSoft: 'rgba(255, 59, 48, 0.08)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.08)',

  // ── Surfaces ──
  bg: '#FFFFFF',
  bgSecondary: '#FAFAF9',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  sheet: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.45)',
  overlayDark: 'rgba(0, 0, 0, 0.70)',

  // ── Text ──
  text: '#1C1917',
  textSecondary: '#78716C',
  textTertiary: '#A8A29E',
  textInverse: '#FFFFFF',
  textInverseSecondary: 'rgba(255, 255, 255, 0.60)',

  // ── Borders ──
  border: '#E7E5E4',
  borderLight: '#EEEEEC',
  borderFocus: '#2563EB',
} as const;
