import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const REQUIRED_VARS = [
  {
    name: 'EXPO_PUBLIC_SUPABASE_URL',
    example: 'https://yourproject.supabase.co',
    hint: 'Supabase project URL (Settings → API)',
  },
  {
    name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    example: 'eyJhbGciOiJI...',
    hint: 'Supabase anon/public key (Settings → API)',
  },
];

const OPTIONAL_VARS = [
  {
    name: 'EXPO_PUBLIC_API_BASE_URL',
    example: 'https://your-app.vercel.app',
    hint: 'Your Next.js API server URL (for OTP, rides, dispatch)',
  },
  {
    name: 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
    example: 'AIzaSy...',
    hint: 'Google Maps API key (for map + Places + Directions)',
  },
  {
    name: 'EXPO_PUBLIC_AUTH_MODE',
    example: 'dev',
    hint: 'Set to "production" for real SMS OTP. Default: dev (code 123456)',
  },
];

interface Props {
  missing: string[];
}

export function EnvMissing({ missing }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>{'\u2699'}</Text>
        </View>

        <Text style={styles.title}>Environment Setup Required</Text>
        <Text style={styles.subtitle}>
          The app needs environment variables to connect to Supabase.
          Create a file at:
        </Text>

        <View style={styles.pathBox}>
          <Text style={styles.pathText}>packages/rider/.env.local</Text>
        </View>

        <Text style={styles.sectionTitle}>REQUIRED</Text>
        {REQUIRED_VARS.map((v) => (
          <View
            key={v.name}
            style={[
              styles.varCard,
              missing.includes(v.name) && styles.varCardMissing,
            ]}
          >
            <View style={styles.varHeader}>
              <Text style={styles.varName}>{v.name}</Text>
              {missing.includes(v.name) && (
                <Text style={styles.badge}>MISSING</Text>
              )}
            </View>
            <Text style={styles.varHint}>{v.hint}</Text>
            <Text style={styles.varExample}>{v.example}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>OPTIONAL</Text>
        {OPTIONAL_VARS.map((v) => (
          <View key={v.name} style={styles.varCard}>
            <Text style={styles.varName}>{v.name}</Text>
            <Text style={styles.varHint}>{v.hint}</Text>
            <Text style={styles.varExample}>{v.example}</Text>
          </View>
        ))}

        <View style={styles.stepsBox}>
          <Text style={styles.stepsTitle}>Steps</Text>
          <Text style={styles.step}>
            1. Copy your Supabase project URL and anon key from{'\n'}
            {'   '}supabase.com → Project Settings → API
          </Text>
          <Text style={styles.step}>
            2. Create <Text style={styles.mono}>packages/rider/.env.local</Text> with the values
          </Text>
          <Text style={styles.step}>
            3. Restart the Expo dev server (<Text style={styles.mono}>npx expo start</Text>)
          </Text>
        </View>

        <Text style={styles.footer}>
          Env vars prefixed with EXPO_PUBLIC_ are embedded at build time by Metro.
          You must restart the dev server after changing them.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, paddingBottom: 64 },
  iconBox: { alignItems: 'center', marginBottom: 16 },
  icon: { fontSize: 48 },
  title: {
    fontSize: 22, fontWeight: '700', color: '#0F172A',
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: 15, color: '#64748B', textAlign: 'center',
    lineHeight: 22, marginBottom: 16,
  },
  pathBox: {
    backgroundColor: '#0F172A', borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 16,
    alignSelf: 'center', marginBottom: 24,
  },
  pathText: {
    fontFamily: 'monospace', fontSize: 14, color: '#22C55E',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 0.5, marginBottom: 8, marginTop: 8,
  },
  varCard: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  varCardMissing: {
    borderColor: '#FBBF24', backgroundColor: '#FFFBEB',
  },
  varHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  varName: {
    fontFamily: 'monospace', fontSize: 13, fontWeight: '600',
    color: '#0F172A',
  },
  badge: {
    fontSize: 10, fontWeight: '700', color: '#D97706',
    backgroundColor: '#FEF3C7', paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
  varHint: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  varExample: {
    fontFamily: 'monospace', fontSize: 12, color: '#94A3B8',
  },
  stepsBox: {
    backgroundColor: '#F1F5F9', borderRadius: 10, padding: 16,
    marginTop: 24,
  },
  stepsTitle: {
    fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 12,
  },
  step: {
    fontSize: 14, color: '#334155', lineHeight: 22, marginBottom: 8,
  },
  mono: {
    fontFamily: 'monospace', fontSize: 13, color: '#3B82F6',
  },
  footer: {
    fontSize: 12, color: '#94A3B8', textAlign: 'center',
    marginTop: 24, lineHeight: 18,
  },
});
