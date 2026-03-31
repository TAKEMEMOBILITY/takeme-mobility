import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth';
import { useSupabase } from '@/providers/supabase';
import { formatCurrency, formatRelativeTime } from '@takeme/shared';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface RideHistoryItem {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  final_fare: number | null;
  estimated_fare: number;
  vehicle_class: string;
  trip_completed_at: string | null;
  status: string;
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const supabase = useSupabase();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRides = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('rides')
        .select('id, pickup_address, dropoff_address, final_fare, estimated_fare, vehicle_class, trip_completed_at, status')
        .eq('rider_id', user.id)
        .in('status', ['completed', 'cancelled'])
        .order('requested_at', { ascending: false })
        .limit(50);
      setRides((data as RideHistoryItem[]) ?? []);
    } catch (err) {
      console.error('Failed to fetch rides:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, supabase]);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  const onRefresh = () => { setRefreshing(true); fetchRides(); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.header}>Activity</Text>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Loading...</Text>
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <View style={styles.emptyLine} />
            <View style={[styles.emptyLine, { width: 28, opacity: 0.4 }]} />
          </View>
          <Text style={styles.emptyTitle}>No rides yet</Text>
          <Text style={styles.emptyBody}>
            Your ride history will appear here{'\n'}after your first trip.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={styles.rideCard}>
              <View style={styles.rideHeader}>
                <Text style={styles.rideDate}>
                  {item.trip_completed_at ? formatRelativeTime(item.trip_completed_at) : item.status}
                </Text>
                <Text style={styles.rideFare}>
                  {formatCurrency(Number(item.final_fare ?? item.estimated_fare))}
                </Text>
              </View>
              <Text style={styles.rideAddr} numberOfLines={1}>{item.pickup_address}</Text>
              <Text style={styles.rideArrow}>{'\u2193'}</Text>
              <Text style={styles.rideAddr} numberOfLines={1}>{item.dropoff_address}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    ...typography.h2, color: colors.text,
    paddingHorizontal: spacing.screen, paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  emptyIcon: { alignItems: 'center', marginBottom: spacing['2xl'] },
  emptyLine: {
    width: 40, height: 3, backgroundColor: colors.gray200,
    borderRadius: 2, marginBottom: 8,
  },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyBody: {
    ...typography.caption, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  rideCard: {
    backgroundColor: colors.gray50, borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  rideHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rideDate: { fontSize: 12, color: colors.textSecondary },
  rideFare: { fontSize: 15, fontWeight: '600', color: colors.text },
  rideAddr: { fontSize: 14, color: colors.text },
  rideArrow: { fontSize: 12, color: colors.gray200, marginVertical: 2 },
});
