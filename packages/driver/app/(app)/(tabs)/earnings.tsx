import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatCurrency, formatRelativeTime, API } from '@takeme/shared';
import { useTrip } from '@/providers/trip';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

interface WalletData {
  available: number;
  pending: number;
  lifetime: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function EarningsScreen() {
  const { apiClient } = useTrip();
  const [wallet, setWallet] = useState<WalletData>({ available: 0, pending: 0, lifetime: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = useCallback(async () => {
    if (!apiClient) return;
    try {
      const data = await apiClient.get<{
        wallet?: WalletData;
        transactions?: Transaction[];
      }>(API.DRIVER_DASHBOARD);
      if (data.wallet) setWallet(data.wallet);
      if (data.transactions) setTransactions(data.transactions);
    } catch {
      // fail silently
    } finally {
      setRefreshing(false);
    }
  }, [apiClient]);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  const onRefresh = () => { setRefreshing(true); fetchEarnings(); };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.header}>Earnings</Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(wallet.available)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.statAmount}>{formatCurrency(wallet.pending)}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStat}>
              <Text style={styles.statAmount}>{formatCurrency(wallet.lifetime)}</Text>
              <Text style={styles.statLabel}>Lifetime</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Text style={styles.emptyText}>Your earnings activity will appear here</Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txCard}>
              <View style={styles.txRow}>
                <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                <Text style={[styles.txAmount, tx.type === 'payout' && { color: colors.error }]}>
                  {tx.type === 'payout' ? '-' : '+'}{formatCurrency(tx.amount)}
                </Text>
              </View>
              <Text style={styles.txDate}>{formatRelativeTime(tx.created_at)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing['5xl'] },
  header: {
    ...typography.h2, color: colors.text,
    paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg, paddingBottom: spacing.xl,
  },
  balanceCard: {
    marginHorizontal: spacing['2xl'], padding: spacing.xl,
    backgroundColor: colors.primary, borderRadius: borderRadius.lg, marginBottom: spacing['3xl'],
  },
  balanceLabel: { ...typography.caption, color: colors.gray400 },
  balanceAmount: { ...typography.h1, color: colors.white, marginTop: spacing.xs },
  balanceRow: {
    flexDirection: 'row', marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray700, paddingTop: spacing.lg,
  },
  balanceStat: { flex: 1, alignItems: 'center' },
  balanceDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.gray700 },
  statAmount: { ...typography.bodyBold, color: colors.white },
  statLabel: { ...typography.small, color: colors.gray400, marginTop: 4 },
  sectionTitle: {
    ...typography.captionBold, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, paddingHorizontal: spacing['2xl'], marginBottom: spacing.md,
  },
  emptyActivity: { marginHorizontal: spacing['2xl'], padding: spacing['3xl'], alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  txCard: {
    marginHorizontal: spacing['2xl'], paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  txRow: { flexDirection: 'row', justifyContent: 'space-between' },
  txDesc: { ...typography.body, color: colors.text, flex: 1, marginRight: spacing.md },
  txAmount: { ...typography.bodyBold, color: colors.accent },
  txDate: { ...typography.small, color: colors.textMuted, marginTop: 4 },
});
