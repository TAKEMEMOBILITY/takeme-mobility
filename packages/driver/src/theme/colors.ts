/**
 * Takeme Driver color palette.
 * Dark primary (#0F172A) with green accent to differentiate from rider app.
 */
export const colors = {
  // Brand
  primary: '#0F172A',
  primaryLight: '#1E293B',
  accent: '#10B981',
  accentLight: '#34D399',
  accentDark: '#059669',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F8FAFC',
  card: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Text
  text: '#0F172A',
  textSecondary: '#64748B',
  textInverse: '#FFFFFF',
  textMuted: '#94A3B8',

  // Borders
  border: '#E2E8F0',
  borderFocused: '#10B981',

  // Driver-specific
  online: '#22C55E',
  offline: '#94A3B8',
  busy: '#F59E0B',
  onTrip: '#3B82F6',
} as const;
