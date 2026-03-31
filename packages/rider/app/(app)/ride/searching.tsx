import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRide } from '@/providers/ride';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

export default function SearchingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeRide, cancelRide } = useRide();
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Watch for driver assignment via Realtime
  useEffect(() => {
    if (activeRide?.status === 'driver_assigned') {
      router.replace({ pathname: '/(app)/ride/assigned' });
    } else if (activeRide?.status === 'cancelled') {
      router.dismissAll();
    }
  }, [activeRide?.status, router]);

  const handleCancel = async () => {
    setCancelling(true);
    await cancelRide();
    router.dismissAll();
  };

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.pulse}>
          <View style={styles.pulseInner} />
        </View>

        <Text style={styles.title}>Finding your driver</Text>
        <Text style={styles.subtitle}>
          Searching for available drivers nearby...
        </Text>
        <Text style={styles.timer}>
          {mm}:{ss.toString().padStart(2, '0')}
        </Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          style={[styles.cancelBtn, cancelling && { opacity: 0.5 }]}
          onPress={handleCancel}
          disabled={cancelling}
        >
          <Text style={styles.cancelText}>{cancelling ? 'Cancelling...' : 'Cancel request'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brand },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },

  pulse: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(201, 169, 110, 0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  pulseInner: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.gold,
  },

  title: { ...typography.h2, color: colors.textInverse, marginBottom: spacing.sm },
  subtitle: {
    ...typography.body, color: colors.textInverseSecondary,
    textAlign: 'center', marginBottom: spacing['2xl'],
  },
  timer: {
    ...typography.numeric, color: 'rgba(255,255,255,0.30)',
  },

  bottom: { paddingHorizontal: spacing.screen },
  cancelBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    borderRadius: radius.md, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { ...typography.button, color: 'rgba(255,255,255,0.50)' },
});
