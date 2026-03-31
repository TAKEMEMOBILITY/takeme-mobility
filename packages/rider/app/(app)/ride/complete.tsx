import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRide } from '@/providers/ride';
import { useSupabase } from '@/providers/supabase';
import { formatCurrency } from '@takeme/shared';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

export default function CompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeRide, clearRide } = useRide();
  const supabase = useSupabase();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const totalFare = Number(activeRide?.final_fare ?? activeRide?.estimated_fare ?? 0);
  const distanceKm = Number(activeRide?.distance_km ?? 0);
  const durationMin = Number(activeRide?.duration_min ?? 0);

  const handleDone = async () => {
    setSubmitting(true);
    try {
      // Submit rating if provided
      if (rating > 0 && activeRide?.id) {
        await supabase
          .from('rides')
          .update({ rider_rating: rating })
          .eq('id', activeRide.id);
      }
    } catch (err) {
      console.error('Failed to submit rating:', err);
    }
    clearRide();
    router.replace('/(app)/(tabs)/home');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkIcon}>{'\u2713'}</Text>
        </View>

        <Text style={styles.title}>Trip complete</Text>

        <View style={styles.fareCard}>
          <Text style={styles.fareAmount}>{formatCurrency(totalFare)}</Text>
          <Text style={styles.fareLabel}>Total fare</Text>

          <View style={styles.fareBreakdown}>
            <FareLine label="Distance" val={`${(distanceKm * 0.621371).toFixed(1)} mi`} />
            <FareLine label="Duration" val={`${durationMin} min`} />
            <FareLine
              label={activeRide?.dropoff_address ?? 'Destination'}
              val=""
            />
          </View>
        </View>

        <Text style={styles.rateLabel}>Rate your driver</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Pressable key={s} onPress={() => setRating(s)} hitSlop={8}>
              <Text style={[styles.star, s <= rating && styles.starActive]}>
                {'\u2605'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          style={[styles.cta, submitting && { opacity: 0.6 }]}
          onPress={handleDone}
          disabled={submitting}
        >
          <Text style={styles.ctaText}>{submitting ? 'Submitting...' : 'Done'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FareLine({ label, val }: { label: string; val: string }) {
  return (
    <View style={styles.fareLine}>
      <Text style={styles.fareLineLabel} numberOfLines={1}>{label}</Text>
      {val ? <Text style={styles.fareLineVal}>{val}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1, alignItems: 'center',
    paddingTop: spacing['7xl'], paddingHorizontal: spacing.screen,
  },
  checkCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing['2xl'],
  },
  checkIcon: { fontSize: 30, color: colors.white },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing['3xl'] },
  fareCard: {
    width: '100%', backgroundColor: colors.gray50,
    borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing['4xl'],
  },
  fareAmount: { ...typography.numericLg, color: colors.text },
  fareLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xl },
  fareBreakdown: {
    width: '100%', borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border, paddingTop: spacing.md,
  },
  fareLine: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3,
  },
  fareLineLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  fareLineVal: { ...typography.captionMedium, color: colors.text },
  rateLabel: { ...typography.bodyMedium, color: colors.text, marginBottom: spacing.lg },
  stars: { flexDirection: 'row', gap: 16 },
  star: { fontSize: 36, color: colors.gray200 },
  starActive: { color: colors.gold },
  bottom: { paddingHorizontal: spacing.screen },
  cta: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...typography.buttonLg, color: colors.brand },
});
