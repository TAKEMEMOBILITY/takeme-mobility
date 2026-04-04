import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title, onPress, variant = 'primary',
  disabled = false, loading = false, fullWidth = false, style,
}: Props) {
  const off = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        v[variant],
        fullWidth && styles.full,
        pressed && !off && styles.pressed,
        off && styles.off,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.brand : colors.gold}
        />
      ) : (
        <Text style={[typography.buttonLg, t[variant], off && styles.offText]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, minHeight: 56,
    paddingHorizontal: spacing['2xl'],
  },
  full: { width: '100%' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  off: { opacity: 0.45 },
  offText: { opacity: 0.8 },
});

const v: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.gold },
  secondary: { backgroundColor: colors.gray100 },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.gray300 },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.errorSoft },
};

const t: Record<Variant, { color: string }> = {
  primary: { color: colors.brand },
  secondary: { color: colors.text },
  outline: { color: colors.text },
  ghost: { color: colors.accent },
  danger: { color: colors.error },
};
