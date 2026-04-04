import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BLACK = '#0B0B0C';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hero — brand + headline as one centered unit */}
      <View style={styles.hero}>
        <Text style={styles.wordmark}>TAKEME</Text>

        <Text style={styles.headline}>
          The future{'\n'}of moving.
        </Text>

        <Text style={styles.subline}>
          Premium electric rides in Seattle.{'\n'}Quiet. Clean. Effortless.
        </Text>
      </View>

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 32 }]}>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>

        <Pressable
          style={styles.secondary}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.secondaryText}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── Hero (brand + headline, centered as one group) ──
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  wordmark: {
    fontSize: 46,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 10,
    marginBottom: 20,
  },
  headline: {
    fontSize: 28,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 14,
  },
  subline: {
    fontSize: 15,
    fontWeight: '400',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },

  // ── Actions ──
  actions: {
    paddingHorizontal: 24,
  },
  cta: {
    backgroundColor: BLACK,
    borderRadius: 14,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  secondary: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A0A0A0',
  },
});
