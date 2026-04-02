import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth';
import { Button, Input } from '@/components/ui';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

type LoginMethod = 'phone' | 'email';

export default function DriverLoginScreen() {
  const router = useRouter();
  const { sendOtp, sendEmailOtp, loading } = useAuth();
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const cleaned = phone.replace(/\D/g, '');
  const isPhoneValid = cleaned.length >= 10;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValid = method === 'phone' ? isPhoneValid : isEmailValid;

  const handleSendOtp = async () => {
    setError('');
    if (method === 'phone') {
      if (cleaned.length < 10) {
        setError('Please enter a valid phone number');
        return;
      }
      const fullPhone = cleaned.length === 10 ? `+1${cleaned}` : `+${cleaned}`;
      const result = await sendOtp(fullPhone);
      if (result.success) {
        router.push({
          pathname: '/(auth)/verify',
          params: { phone: fullPhone, method: 'phone' },
        });
      } else {
        setError(result.error ?? 'Failed to send code');
      }
    } else {
      if (!isEmailValid) {
        setError('Please enter a valid email address');
        return;
      }
      const result = await sendEmailOtp(email.trim());
      if (result.success) {
        router.push({
          pathname: '/(auth)/verify',
          params: { email: email.trim(), method: 'email' },
        });
      } else {
        setError(result.error ?? 'Failed to send code');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>T</Text>
          </View>
          <Text style={styles.title}>Takeme Driver</Text>
          <Text style={styles.subtitle}>
            Sign in to start earning
          </Text>

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

          {method === 'phone' ? (
            <Input
              label="Phone Number"
              placeholder="(206) 555-0123"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => { setPhone(text); setError(''); }}
              error={error}
              containerStyle={styles.input}
            />
          ) : (
            <Input
              label="Email Address"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => { setEmail(text); setError(''); }}
              error={error}
              containerStyle={styles.input}
            />
          )}
        </View>

        <View style={styles.bottom}>
          <Button
            title="Continue"
            onPress={handleSendOtp}
            size="lg"
            fullWidth
            loading={loading}
            disabled={!isValid}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
  },
  content: {
    flex: 1,
    paddingTop: spacing['5xl'],
    alignItems: 'center',
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 4,
    marginBottom: spacing.xl,
    width: '100%',
  },
  toggleTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleTabActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleText: { ...typography.caption, color: colors.textMuted },
  toggleTextActive: { ...typography.captionBold, color: colors.text },
  input: {
    marginBottom: spacing.lg,
  },
  bottom: {
    paddingBottom: spacing['3xl'],
  },
});
