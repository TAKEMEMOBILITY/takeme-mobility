import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocation } from '@/providers/location';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';

const SEATTLE = {
  latitude: 47.6062, longitude: -122.3321,
  latitudeDelta: 0.03, longitudeDelta: 0.03,
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { location, permissionGranted, requestPermission } = useLocation();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude, longitude: location.longitude,
        latitudeDelta: 0.015, longitudeDelta: 0.015,
      }, 600);
    }
  }, [location]);

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={location ? {
          latitude: location.latitude, longitude: location.longitude,
          latitudeDelta: 0.015, longitudeDelta: 0.015,
        } : SEATTLE}
        showsUserLocation={permissionGranted === true}
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        mapPadding={{ top: 0, right: 0, bottom: 260, left: 0 }}
      >
        {location && permissionGranted !== true && (
          <Marker coordinate={location} pinColor={colors.text} />
        )}
      </MapView>

      {/* Location permission overlay */}
      {permissionGranted === false && (
        <View style={styles.permOverlay}>
          <View style={styles.permCard}>
            <Text style={styles.permTitle}>Enable Location</Text>
            <Text style={styles.permBody}>
              We need your location to connect you with nearby drivers.
            </Text>
            <Pressable style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Allow</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Re-center */}
      {location && (
        <Pressable
          style={[styles.recenter, { top: insets.top + spacing.lg }]}
          onPress={() => mapRef.current?.animateToRegion({
            latitude: location.latitude, longitude: location.longitude,
            latitudeDelta: 0.015, longitudeDelta: 0.015,
          }, 400)}
        >
          <Text style={styles.recenterIcon}>{'\u25CE'}</Text>
        </Pressable>
      )}

      {/* Premium bottom sheet */}
      <View style={[styles.sheet, shadow.lg]}>
        <View style={styles.handle} />

        <Text style={styles.greeting}>Where to?</Text>

        <Pressable
          style={styles.searchBar}
          onPress={() => router.push('/(app)/ride/destination')}
        >
          <View style={styles.searchDot} />
          <Text style={styles.searchPlaceholder}>Search destination</Text>
        </Pressable>

        <View style={styles.quickRow}>
          {[
            { label: 'Home', icon: '\u2302' },
            { label: 'Work', icon: '\u2606' },
            { label: 'Airport', icon: '\u2708' },
          ].map((q) => (
            <Pressable key={q.label} style={styles.quickChip}>
              <Text style={styles.quickIcon}>{q.icon}</Text>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Permission
  permOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  permCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing['3xl'], alignItems: 'center',
    width: '80%', ...shadow.md,
  },
  permTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  permBody: {
    ...typography.caption, color: colors.textSecondary,
    textAlign: 'center', marginBottom: spacing['2xl'],
  },
  permBtn: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing['3xl'],
  },
  permBtnText: { ...typography.buttonLg, color: colors.brand },

  // Recenter
  recenter: {
    position: 'absolute', right: spacing.lg,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  recenterIcon: { fontSize: 18, color: colors.text },

  // Bottom sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md, paddingBottom: spacing['2xl'],
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.gray200, alignSelf: 'center',
    marginBottom: spacing['2xl'],
  },
  greeting: {
    ...typography.h2, color: colors.text, marginBottom: spacing.xl,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, height: 52,
    marginBottom: spacing.xl,
  },
  searchDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.gold, marginRight: spacing.md,
  },
  searchPlaceholder: { ...typography.body, color: colors.gray400 },

  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gray50, borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  quickIcon: { fontSize: 14, marginRight: spacing.sm, color: colors.gray500 },
  quickLabel: { ...typography.captionMedium, color: colors.text },
});
