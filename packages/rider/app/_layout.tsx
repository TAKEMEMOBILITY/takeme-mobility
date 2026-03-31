import React, { useEffect } from 'react';
import { Slot, ErrorBoundary } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { SupabaseProvider, isSupabaseConfigured } from '@/providers/supabase';
import { AuthProvider } from '@/providers/auth';
import { LocationProvider } from '@/providers/location';
import { RideProvider } from '@/providers/ride';
import { StripeProvider } from '@/providers/stripe';
import { EnvMissing } from '@/components/EnvMissing';

export { ErrorBoundary };

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  if (!isSupabaseConfigured) {
    const missing: string[] = [];
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
    if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');

    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="dark" />
        <EnvMissing missing={missing} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StripeProvider>
        <SupabaseProvider>
          <AuthProvider>
            <LocationProvider>
              <RideProvider>
                <StatusBar style="dark" />
                <Slot />
              </RideProvider>
            </LocationProvider>
          </AuthProvider>
        </SupabaseProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
