import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

type LoginMethod = 'phone' | 'email';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sendOtp, sendEmailOtp, loading } = useAuth();
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const cleaned = phone.replace(/\D/g, '');
  const isPhoneValid = cleaned.length >= 10;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValid = method === 'phone' ? isPhoneValid : isEmailValid;

  const handleContinue = async () => {
    setError('');
    if (method === 'phone') {
      const fullPhone = cleaned.length === 10 ? `+1${cleaned}` : `+${cleaned}`;
      const result = await sendOtp(fullPhone);
      if (result.success) {
        router.push({ pathname: '/(auth)/verify', params: { phone: fullPhone, method: 'phone' } });
      } else {
        setError(result.error ?? 'Failed to send code');
      }
    } else {
      const result = await sendEmailOtp(email.trim());
      if (result.success) {
        router.push({ pathname: '/(auth)/verify', params: { email: email.trim(), method: 'email' } });
      } else {
        setError(result.error ?? 'Failed to send code');
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          {/* Back */}
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backText}>{'\u2190'}</Text>
          </Pressable>

          <View style={styles.headingBlock}>
            <Text style={styles.title}>
              {method === 'phone' ? 'Your phone\nnumber' : 'Your email\naddress'}
            </Text>
            <Text style={styles.subtitle}>
              {method === 'phone'
                ? "We'll text you a verification code to sign in securely."
                : "We'll email you a verification code to sign in securely."}
            </Text>
          </View>

          {/* Phone / Email toggle */}
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleTab, method === 'phone' && styles.toggleTabActive]}
              onPress={() => { setMethod('phone'); setError(''); }}
            >
              <Text style={[styles.toggleText, method === 'phone' && styles.toggleTextActive]}>Phone</Text>
            </Pressable>
            <Pressable
              style={[styles.toggleTab, method === 'email' && styles.toggleTabActive]}
              onPress={() => { setMethod('email'); setError(''); }}
            >
              <Text style={[styles.toggleText, method === 'email' && styles.toggleTextActive]}>Email</Text>
            </Pressable>
          </View>

          {/* Dev hint */}
          <View style={styles.devHint}>
            <Text style={styles.devHintText}>Development mode — use code 123456</Text>
          </View>

          {/* Input */}
          {method === 'phone' ? (
            <View style={[styles.inputWrap, error && styles.inputWrapError]}>
              <Text style={styles.prefix}>+1</Text>
              <TextInput
                style={styles.input}
                placeholder="(206) 555-0123"
                placeholderTextColor={colors.gray400}
                keyboardType="phone-pad"
                autoFocus
                value={phone}
                onChangeText={(t) => { setPhone(t); setError(''); }}
                selectionColor={colors.accent}
              />
            </View>
          ) : (
            <View style={[styles.inputWrap, error && styles.inputWrapError]}>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.gray400}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                selectionColor={colors.accent}
              />
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {/* CTA */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Pressable
            style={[styles.cta, !isValid && styles.ctaDisabled]}
            disabled={!isValid || loading}
            onPress={handleContinue}
          >
            {loading ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Text style={styles.ctaText}>Continue</Text>
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

  backBtn: { paddingVertical: spacing.lg },
  backText: { fontSize: 28, color: colors.text, fontWeight: '300' },

  headingBlock: { marginTop: spacing.lg, marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },

  toggleRow: {
    flexDirection: 'row', backgroundColor: colors.gray100,
    borderRadius: radius.md, padding: 4, marginBottom: spacing.xl,
  },
  toggleTab: {
    flex: 1, paddingVertical: spacing.sm,
    alignItems: 'center', borderRadius: radius.sm,
  },
  toggleTabActive: { backgroundColor: colors.bg, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleText: { ...typography.captionMedium, color: colors.gray500 },
  toggleTextActive: { color: colors.text },

  devHint: {
    backgroundColor: colors.gray100, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginBottom: spacing['2xl'], alignSelf: 'flex-start',
  },
  devHintText: { ...typography.small, color: colors.gray500 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gray100, borderRadius: radius.md,
    borderWidth: 1, borderColor: 'transparent',
    paddingHorizontal: spacing.lg, minHeight: 56,
  },
  inputWrapError: { borderColor: colors.error },
  prefix: { ...typography.bodyMedium, color: colors.gray500, marginRight: spacing.sm },
  input: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.lg },
  error: { ...typography.small, color: colors.error, marginTop: spacing.sm },

  bottom: { paddingHorizontal: spacing.screen },
  cta: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.35 },
  ctaText: { ...typography.buttonLg, color: colors.brand },
});
