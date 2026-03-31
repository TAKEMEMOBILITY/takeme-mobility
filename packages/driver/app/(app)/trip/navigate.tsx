import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatRating, API } from '@takeme/shared';
import { Button } from '@/components/ui';
import { useTrip } from '@/providers/trip';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

export default function NavigateScreen() {
  const router = useRouter();
  const { activeTrip, riderInfo, apiClient } = useTrip();
  const [loading, setLoading] = useState(false);

  const handleArrived = async () => {
    if (!activeTrip || !apiClient || loading) return;
    setLoading(true);
    try {
      await apiClient.put(API.DRIVER_RIDES, {
        rideId: activeTrip.id,
        action: 'arrived',
      });
      router.replace('/(app)/trip/arrived');
    } catch (err) {
      Alert.alert('Error', 'Could not update status.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapLabel}>Navigating to pickup</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.etaText}>
          {activeTrip?.duration_min ?? '...'} min to pickup
        </Text>
        <Text style={styles.address}>
          {activeTrip?.pickup_address ?? 'Loading...'}
        </Text>

        <View style={styles.riderInfo}>
          <View style={styles.riderAvatar}>
            <Text style={styles.avatarText}>
              {(riderInfo?.name ?? 'R')[0]}
            </Text>
          </View>
          <View>
            <Text style={styles.riderName}>{riderInfo?.name ?? 'Rider'}</Text>
            <Text style={styles.riderRating}>
              {'\u2605'} {formatRating(riderInfo?.rating ?? 5.0)}
            </Text>
          </View>
        </View>

        <Button
          title={loading ? 'Updating...' : 'Arrived at Pickup'}
          onPress={handleArrived}
          size="lg"
          fullWidth
          disabled={loading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapPlaceholder: {
    flex: 1, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  mapLabel: { ...typography.h3, color: colors.textMuted },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing['2xl'],
    shadowColor: colors.black, shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 8,
  },
  etaText: { ...typography.h3, color: colors.accent, marginBottom: spacing.xs },
  address: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  riderInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  riderAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  avatarText: { ...typography.bodyBold, color: colors.white },
  riderName: { ...typography.bodyBold, color: colors.text },
  riderRating: { ...typography.caption, color: colors.warning, marginTop: 2 },
});
