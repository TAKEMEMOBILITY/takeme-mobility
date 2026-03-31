import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatCurrency } from '@takeme/shared';
import { Button } from '@/components/ui';
import { useTrip } from '@/providers/trip';
import { useSupabase } from '@/providers/supabase';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

const PLATFORM_FEE_RATE = 0.20;

export default function TripCompleteScreen() {
  const router = useRouter();
  const { activeTrip, clearTrip } = useTrip();
  const supabase = useSupabase();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fare = Number(activeTrip?.final_fare ?? activeTrip?.estimated_fare ?? 0);
  const platformFee = Math.round(fare * PLATFORM_FEE_RATE * 100) / 100;
  const driverEarnings = Math.round((fare - platformFee) * 100) / 100;

  const handleDone = async () => {
    setSubmitting(true);
    try {
      if (rating > 0 && activeTrip?.id) {
        await supabase
          .from('rides')
          .update({ driver_rating: rating })
          .eq('id', activeTrip.id);
      }
    } catch (err) {
      console.error('Failed to submit rating:', err);
    }
    clearTrip();
    router.replace('/(app)/(tabs)/dashboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>{'\u2713'}</Text>
        </View>

        <Text style={styles.title}>Trip Complete</Text>

        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>You earned</Text>
          <Text style={styles.earningsAmount}>{formatCurrency(driverEarnings)}</Text>
          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Fare</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(fare)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Takeme fee ({Math.round(PLATFORM_FEE_RATE * 100)}%)</Text>
              <Text style={styles.breakdownValue}>-{formatCurrency(platformFee)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.rateLabel}>Rate your rider</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)}>
              <Text style={[styles.star, star <= rating && styles.starSelected]}>
                {'\u2605'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.bottom}>
        <Button
          title={submitting ? 'Submitting...' : 'Done'}
          onPress={handleDone}
          size="lg"
          fullWidth
          disabled={submitting}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1, alignItems: 'center',
    paddingTop: spacing['5xl'], paddingHorizontal: spacing['2xl'],
  },
  checkmark: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing['2xl'],
  },
  checkmarkText: { fontSize: 32, color: colors.white },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing['2xl'] },
  earningsCard: {
    width: '100%', backgroundColor: colors.accent + '10',
    borderRadius: borderRadius.lg, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing['3xl'],
  },
  earningsLabel: { ...typography.caption, color: colors.textSecondary },
  earningsAmount: { ...typography.h1, color: colors.accent, marginTop: spacing.xs },
  breakdown: {
    width: '100%', marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs,
  },
  breakdownLabel: { ...typography.caption, color: colors.textSecondary },
  breakdownValue: { ...typography.caption, color: colors.text },
  rateLabel: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.md },
  stars: { flexDirection: 'row', gap: spacing.md },
  star: { fontSize: 36, color: colors.gray300 },
  starSelected: { color: colors.warning },
  bottom: { paddingHorizontal: spacing['2xl'], paddingBottom: spacing['3xl'] },
});
