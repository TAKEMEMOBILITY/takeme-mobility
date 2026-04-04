import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { isStripeConfigured } from '@/providers/stripe';

interface Props {
  lastMethod: string | null;
  loading: boolean;
  onAddPayment: () => void;
}

/**
 * Payment method display / add button.
 * Shown in the quotes screen before the CTA.
 */
export function PaymentMethod({ lastMethod, loading, onAddPayment }: Props) {
  if (!isStripeConfigured) {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <Text style={styles.icon}>{'\u2637'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Payment</Text>
            <Text style={styles.hint}>Stripe not configured</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onAddPayment}
      disabled={loading}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color="#000" style={{ marginRight: 12 }} />
        ) : (
          <Text style={styles.icon}>{lastMethod ? '\u2713' : '\u002B'}</Text>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Payment</Text>
          <Text style={styles.value}>
            {lastMethod ?? 'Add payment method'}
          </Text>
        </View>
        <Text style={styles.chevron}>{'\u203A'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  pressed: { backgroundColor: '#FAFAFA' },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 18, color: '#000', marginRight: 12, width: 24, textAlign: 'center' },
  label: { fontSize: 11, fontWeight: '600', color: '#A0A0A0', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: '500', color: '#000' },
  hint: { fontSize: 13, color: '#CCC' },
  chevron: { fontSize: 22, fontWeight: '300', color: '#CCC', marginLeft: 8 },
});
