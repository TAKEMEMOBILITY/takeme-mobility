import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

const CODE_LENGTH = 6;

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1'))
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}

export default function VerifyScreen() {
  const { phone, email, method } = useLocalSearchParams<{ phone?: string; email?: string; method: 'phone' | 'email' }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifyOtp, sendOtp, verifyEmailOtp, sendEmailOtp, loading } = useAuth();

  const isEmail = method === 'email';
  const identifier = isEmail ? email : phone;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(30);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = useCallback(async (otp: string) => {
    if (otp.length !== CODE_LENGTH || !identifier) return;
    setError('');
    const result = isEmail
      ? await verifyEmailOtp(identifier, otp)
      : await verifyOtp(identifier, otp);
    if (result.success) {
      router.replace('/(app)/(tabs)/home');
    } else {
      setError(result.error ?? 'Invalid code');
      setCode('');
    }
  }, [identifier, isEmail, verifyOtp, verifyEmailOtp, router]);

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === CODE_LENGTH) handleVerify(code);
  }, [code, handleVerify]);

  const handleResend = async () => {
    if (cooldown > 0 || !identifier) return;
    const result = isEmail
      ? await sendEmailOtp(identifier)
      : await sendOtp(identifier);
    if (result.success) setCooldown(30);
    else setError(result.error ?? 'Failed to resend');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backText}>{'\u2190'}</Text>
          </Pressable>

          <View style={styles.headingBlock}>
            <Text style={styles.title}>Verification</Text>
            <Text style={styles.subtitle}>
              Enter the code sent to{'\n'}
              <Text style={styles.phoneHighlight}>{isEmail ? (email ?? '') : (phone ? formatPhone(phone) : '')}</Text>
            </Text>
          </View>

          {/* Dev autofill */}
          <Pressable
            style={styles.devHint}
            onPress={() => setCode('123456')}
          >
            <Text style={styles.devHintText}>Tap to autofill 123456</Text>
          </Pressable>

          {/* Hidden input */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH)); setError(''); }}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            style={styles.hiddenInput}
          />

          {/* Code cells */}
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.codeRow}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const filled = i < code.length;
              const active = i === code.length;
              return (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    filled && styles.cellFilled,
                    active && styles.cellActive,
                    error && styles.cellError,
                  ]}
                >
                  {filled ? (
                    <View style={styles.cellDot} />
                  ) : (
                    <Text style={styles.cellPlaceholder}>{active ? '|' : ''}</Text>
                  )}
                </View>
              );
            })}
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={handleResend} disabled={cooldown > 0}>
            <Text style={[styles.resend, cooldown > 0 && styles.resendOff]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Pressable
            style={[styles.cta, code.length !== CODE_LENGTH && styles.ctaDisabled]}
            disabled={code.length !== CODE_LENGTH || loading}
            onPress={handleVerify}
          >
            {loading ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Text style={styles.ctaText}>Verify</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.screen },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },

  backBtn: { paddingVertical: spacing.lg },
  backText: { fontSize: 28, color: colors.text, fontWeight: '300' },

  headingBlock: { marginTop: spacing.lg, marginBottom: spacing['2xl'] },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 26 },
  phoneHighlight: { color: colors.text, fontWeight: '500' },

  devHint: {
    backgroundColor: colors.gray100, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginBottom: spacing['3xl'], alignSelf: 'flex-start',
  },
  devHintText: { ...typography.small, color: colors.gray500 },

  // ── Code cells ──
  codeRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 10, marginBottom: spacing.xl,
  },
  cell: {
    width: 48, height: 56, borderRadius: radius.md,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  cellFilled: { backgroundColor: colors.gray150 },
  cellActive: { borderColor: colors.gray300 },
  cellError: { borderColor: colors.error, backgroundColor: colors.errorSoft },
  cellDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.text },
  cellPlaceholder: { ...typography.body, color: colors.gray400 },

  error: { ...typography.small, color: colors.error, textAlign: 'center', marginBottom: spacing.md },

  resend: { ...typography.captionMedium, color: colors.accent, textAlign: 'center' },
  resendOff: { color: colors.gray400 },

  bottom: { paddingHorizontal: spacing.screen },
  cta: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.35 },
  ctaText: { ...typography.buttonLg, color: colors.brand },
});
