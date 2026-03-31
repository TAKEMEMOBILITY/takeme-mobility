import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRide } from '@/providers/ride';
import { formatCurrency, formatDistanceMi, formatDuration } from '@takeme/shared';

export default function TrackingScreen() {
  const router = useRouter();
  const { activeRide, driverLocation } = useRide();
  const [elapsed, setElapsed] = useState(0);
  const mapRef = useRef<MapView>(null);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Watch for ride completion
  useEffect(() => {
    if (activeRide?.status === 'completed') {
      router.replace({ pathname: '/(app)/ride/complete' });
    } else if (activeRide?.status === 'cancelled') {
      router.dismissAll();
    }
  }, [activeRide?.status, router]);

  const dropoff = activeRide ? {
    latitude: Number(activeRide.dropoff_lat),
    longitude: Number(activeRide.dropoff_lng),
  } : { latitude: 47.6062, longitude: -122.3321 };

  const driverPos = driverLocation ?? dropoff;

  // Compute progress
  const totalMin = activeRide?.duration_min ?? 10;
  const elapsedMin = elapsed / 60;
  const progress = Math.min((elapsedMin / totalMin) * 100, 95);

  // Fit map to driver + dropoff
  useEffect(() => {
    if (mapRef.current && driverPos) {
      mapRef.current.fitToCoordinates([driverPos, dropoff], {
        edgePadding: { top: 80, right: 60, bottom: 240, left: 60 },
        animated: true,
      });
    }
  }, [driverPos.latitude, driverPos.longitude]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: (driverPos.latitude + dropoff.latitude) / 2,
            longitude: (driverPos.longitude + dropoff.longitude) / 2,
            latitudeDelta: 0.025,
            longitudeDelta: 0.025,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          <Marker coordinate={driverPos} title="Driver" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>{'\u2192'}</Text>
            </View>
          </Marker>
          <Marker coordinate={dropoff} title="Dropoff" pinColor="#0F172A" />
        </MapView>
      </View>

      <View style={styles.bar}>
        <Text style={styles.status}>On the way to destination</Text>
        <Text style={styles.eta}>
          {activeRide?.dropoff_address ?? 'Destination'}
        </Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>
              {activeRide?.distance_km ? formatDistanceMi(Number(activeRide.distance_km)) : '...'}
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>
              {formatCurrency(Number(activeRide?.estimated_fare ?? 0))}
            </Text>
            <Text style={styles.statLabel}>Fare</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>
              {activeRide?.duration_min ? formatDuration(Number(activeRide.duration_min)) : '...'}
            </Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapWrap: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  driverMarker: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  driverMarkerText: { fontSize: 16, color: '#fff', fontWeight: '700' },
  bar: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 8,
  },
  status: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  eta: { fontSize: 14, color: '#3B82F6', marginTop: 4, marginBottom: 16 },
  track: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden', marginBottom: 20 },
  fill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  statLabel: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
});
