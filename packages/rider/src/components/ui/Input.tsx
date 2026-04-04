import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, containerStyle, style, ...props }, ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[
          styles.input,
          focused && styles.focused,
          error && styles.error,
          style,
        ]}
        placeholderTextColor={colors.gray400}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        selectionColor={colors.accent}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  label: {
    ...typography.captionMedium, color: colors.gray600,
    marginBottom: spacing.sm, textTransform: 'uppercase',
    letterSpacing: 0.8, fontSize: 11,
  },
  input: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.gray100, borderWidth: 1,
    borderColor: 'transparent', borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
    minHeight: 52,
  },
  focused: { borderColor: colors.gray300, backgroundColor: colors.white },
  error: { borderColor: colors.error },
  errorText: { ...typography.small, color: colors.error, marginTop: spacing.xs },
});
