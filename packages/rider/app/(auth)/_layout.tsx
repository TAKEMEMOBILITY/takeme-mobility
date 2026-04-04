import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

export default function AuthLayout() {
  const { user, loading, initialized } = useAuth();

  if (!initialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Already authenticated — skip to main app
  if (user) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
