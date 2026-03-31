import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocation } from '@/providers/location';
import { useRide } from '@/providers/ride';
import { formatRating } from '@takeme/shared';

export default function AssignedScreen() {
  const router = useRouter();
  const { location } = useLocation();
  const { activeRide, assignedDriver, driverLocation, cancelRide } = useRide();

  const center = location ?? { latitude: 47.6062, longitude: -122.3321 };
  const driverPos = driverLocation ?? center;

  // Watch for status transitions
  useEffect(() => {
    if (!activeRide) return;
    if (activeRide.status === 'arrived' || activeRide.status === 'in_progress') {
      router.replace({ pathname: '/(app)/ride/tracking' });
    } else if (activeRide.status === 'completed') {
      router.replace({ pathname: '/(app)/ride/complete' });
    } else if (activeRide.status === 'cancelled') {
      router.dismissAll();
    }
  }, [activeRide?.status, router]);

  const driverName = assignedDriver?.full_name ?? 'Driver';
  const vehicleDesc = assignedDriver?.vehicle
    ? `${assignedDriver.vehicle.color} ${assignedDriver.vehicle.make} ${assignedDriver.vehicle.model}`
    : 'Vehicle';
  const plateNumber = assignedDriver?.vehicle?.plate_number ?? '';
  const rating = assignedDriver?.rating ?? 5.0;

  const handleCall = () => {
    if (assignedDriver?.phone) {
      Linking.openURL(`tel:${assignedDriver.phone}`);
    }
  };

  const handleCancel = async () => {
    await cancelRide();
    router.dismissAll();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: (center.latitude + driverPos.latitude) / 2,
            longitude: (center.longitude + driverPos.longitude) / 2,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={driverPos}
            title="Driver"
            pinColor="#0F172A"
          />
        </MapView>
      </View>

      <View style={styles.card}>
        <View style={styles.eta}>
          <Text style={styles.etaNum}>{activeRide?.duration_min ?? '...'}</Text>
          <Text style={styles.etaLabel}>min away</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.driverRow}>
          <View style={styles.driverAvatar}>
            <Text style={styles.avatarText}>{driverName[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.vehicleText}>{vehicleDesc} {'\u00B7'} {plateNumber}</Text>
            <Text style={styles.rating}>{'\u2605'} {formatRating(rating)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={handleCall}>
            <Text style={styles.actionText}>Call</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
            onPress={handleCancel}
          >
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapWrap: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  card: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 8,
  },
  eta: { alignItems: 'center', marginBottom: 16 },
  etaNum: { fontSize: 40, fontWeight: '700', color: '#3B82F6' },
  etaLabel: { fontSize: 14, color: '#64748B' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E2E8F0', marginBottom: 16 },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#1E293B',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  avatarText: { fontSize: 20, fontWeight: '600', color: '#fff' },
  driverName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  vehicleText: { fontSize: 13, color: '#64748B', marginTop: 2 },
  rating: { fontSize: 13, fontWeight: '600', color: '#F59E0B', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: '#F1F5F9', borderRadius: 10,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
});
