import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView,
  Keyboard, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useLocation } from '@/providers/location';
import { useAutocomplete } from '@/hooks/useAutocomplete';
import { getDirections } from '@/lib/google-directions';
import type { PlacePrediction } from '@/lib/google-places';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

// ── Types ──

interface LocationValue {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

type ActiveField = 'pickup' | 'dropoff' | null;

// ── Component ──

export default function DestinationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { location: gpsLocation } = useLocation();
  const autocomplete = useAutocomplete();

  // Field state
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickup, setPickup] = useState<LocationValue | null>(null);
  const [dropoff, setDropoff] = useState<LocationValue | null>(null);
  const [activeField, setActiveField] = useState<ActiveField>('dropoff');
  const [isGpsPickup, setIsGpsPickup] = useState(true);

  // Route result (from Directions API)
  const [routeLoading, setRouteLoading] = useState(false);

  const pickupRef = useRef<TextInput>(null);
  const dropoffRef = useRef<TextInput>(null);

  // ── Reverse geocode GPS on mount ──
  useEffect(() => {
    if (!gpsLocation) return;
    let cancelled = false;

    (async () => {
      let addr = 'Current location';
      try {
        const results = await Location.reverseGeocodeAsync(gpsLocation);
        if (!cancelled && results.length > 0) {
          const a = results[0];
          addr = [a.name, a.street, a.city].filter(Boolean).join(', ') || addr;
        }
      } catch {
        // keep default addr
      }

      if (cancelled) return;

      // Only set pickup if user hasn't manually changed it
      setPickup((prev) => {
        if (prev !== null) return prev; // user already picked something
        setPickupText(addr);
        return { address: addr, lat: gpsLocation.latitude, lng: gpsLocation.longitude };
      });
    })();

    return () => { cancelled = true; };
  }, [gpsLocation]);

  // ── Autocomplete on text change ──
  const handlePickupChange = (text: string) => {
    setPickupText(text);
    setPickup(null);
    setIsGpsPickup(false);
    autocomplete.search(text);
  };

  const handleDropoffChange = (text: string) => {
    setDropoffText(text);
    setDropoff(null);
    autocomplete.search(text);
  };

  // ── Select a prediction ──
  const handleSelectPrediction = async (pred: PlacePrediction) => {
    const details = await autocomplete.selectPlace(pred.placeId);
    if (!details) return;

    const val: LocationValue = {
      address: pred.fullText,
      lat: details.lat,
      lng: details.lng,
      placeId: pred.placeId,
    };

    if (activeField === 'pickup') {
      setPickup(val);
      setPickupText(pred.mainText);
      setIsGpsPickup(false);
      setActiveField('dropoff');
      setTimeout(() => dropoffRef.current?.focus(), 100);
    } else {
      setDropoff(val);
      setDropoffText(pred.mainText);
      Keyboard.dismiss();
      setActiveField(null);
    }
  };

  // ── Use current location for pickup ──
  const handleUseGps = () => {
    if (!gpsLocation) return;
    const addr = pickupText || 'Current location';
    setPickup({ address: addr, lat: gpsLocation.latitude, lng: gpsLocation.longitude });
    setPickupText(addr);
    setIsGpsPickup(true);
    autocomplete.clear();
    setActiveField('dropoff');
    setTimeout(() => dropoffRef.current?.focus(), 100);
  };

  // ── Focus handling ──
  const focusPickup = () => {
    setActiveField('pickup');
    setTimeout(() => pickupRef.current?.focus(), 50);
  };

  const focusDropoff = () => {
    setActiveField('dropoff');
    setTimeout(() => dropoffRef.current?.focus(), 50);
  };

  // ── Confirm & get route ──
  const canConfirm = pickup && dropoff && !activeField;

  const handleConfirm = async () => {
    if (!pickup || !dropoff) return;

    setRouteLoading(true);

    // Try Google Directions first
    const dirs = await getDirections(
      { latitude: pickup.lat, longitude: pickup.lng },
      { latitude: dropoff.lat, longitude: dropoff.lng },
    );

    setRouteLoading(false);

    router.push({
      pathname: '/(app)/ride/quotes',
      params: {
        pickupLat: pickup.lat.toString(),
        pickupLng: pickup.lng.toString(),
        dropoffLat: dropoff.lat.toString(),
        dropoffLng: dropoff.lng.toString(),
        pickupLabel: pickup.address,
        dropoffLabel: dropoff.address,
        // Pass Directions data if available
        ...(dirs ? {
          routeDistanceMi: dirs.distanceMi.toString(),
          routeDurationMin: dirs.durationMin.toString(),
          routeDistanceText: dirs.distanceText,
          routeDurationText: dirs.durationText,
          routePolyline: dirs.polyline,
          routeSource: 'directions',
        } : {
          routeSource: 'haversine',
        }),
      },
    });
  };

  // ── Render ──

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back */}
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
        <Text style={styles.backText}>{'\u2190'}</Text>
      </Pressable>

      {/* Input fields */}
      <View style={styles.inputSection}>
        <View style={styles.rail}>
          <View style={[styles.railDot, { backgroundColor: '#000' }]} />
          <View style={styles.railLine} />
          <View style={[styles.railDot, { backgroundColor: colors.gray400 }]} />
        </View>

        <View style={styles.fields}>
          {/* Pickup */}
          <Pressable
            style={[styles.field, activeField === 'pickup' && styles.fieldActive]}
            onPress={focusPickup}
          >
            <TextInput
              ref={pickupRef}
              style={styles.fieldInput}
              value={pickupText}
              onChangeText={handlePickupChange}
              placeholder="Pickup location"
              placeholderTextColor={colors.gray400}
              onFocus={() => setActiveField('pickup')}
              selectTextOnFocus
            />
            {isGpsPickup && pickup && (
              <View style={styles.gpsBadge}>
                <Text style={styles.gpsBadgeText}>{'\u25CE'}</Text>
              </View>
            )}
          </Pressable>

          <View style={{ height: 8 }} />

          {/* Dropoff */}
          <Pressable
            style={[styles.field, activeField === 'dropoff' && styles.fieldActive]}
            onPress={focusDropoff}
          >
            <TextInput
              ref={dropoffRef}
              style={styles.fieldInput}
              value={dropoffText}
              onChangeText={handleDropoffChange}
              placeholder="Where to?"
              placeholderTextColor={colors.gray400}
              onFocus={() => setActiveField('dropoff')}
              autoFocus
            />
          </Pressable>
        </View>
      </View>

      {/* Results list */}
      <ScrollView
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* GPS row — shown when editing pickup */}
        {activeField === 'pickup' && gpsLocation && (
          <Pressable style={styles.gpsRow} onPress={handleUseGps}>
            <View style={styles.gpsIcon}>
              <Text style={styles.gpsIconText}>{'\u25CE'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultMain}>Current location</Text>
              <Text style={styles.resultSub}>Use GPS</Text>
            </View>
          </Pressable>
        )}

        {/* Loading */}
        {autocomplete.loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.gray400} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {/* Predictions from Google Places */}
        {autocomplete.predictions.map((pred) => (
          <Pressable
            key={pred.placeId}
            style={styles.resultRow}
            onPress={() => handleSelectPrediction(pred)}
          >
            <View style={styles.resultIcon}>
              <View style={styles.resultDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultMain} numberOfLines={1}>{pred.mainText}</Text>
              <Text style={styles.resultSub} numberOfLines={1}>{pred.secondaryText}</Text>
            </View>
          </Pressable>
        ))}

        {/* No results */}
        {autocomplete.error && !autocomplete.loading && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>{autocomplete.error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Confirm bar */}
      {canConfirm && (
        <View style={[styles.confirmBar, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.confirmRoute}>
            <View>
              <Text style={styles.confirmLabel}>Pickup</Text>
              <Text style={styles.confirmAddr} numberOfLines={1}>{pickup.address}</Text>
            </View>
            <View style={styles.confirmDivider} />
            <View>
              <Text style={styles.confirmLabel}>Destination</Text>
              <Text style={styles.confirmAddr} numberOfLines={1}>{dropoff.address}</Text>
            </View>
          </View>

          <Pressable
            style={[styles.confirmBtn, routeLoading && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={routeLoading}
          >
            {routeLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmText}>Get fare estimates</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { paddingHorizontal: spacing.screen, paddingVertical: spacing.lg },
  backText: { fontSize: 28, color: '#000', fontWeight: '300' },

  // Inputs
  inputSection: { flexDirection: 'row', paddingHorizontal: spacing.screen, marginBottom: spacing.md },
  rail: { alignItems: 'center', paddingTop: 18, paddingRight: spacing.md, width: 20 },
  railDot: { width: 8, height: 8, borderRadius: 4 },
  railLine: { width: 1.5, flex: 1, backgroundColor: colors.gray200, marginVertical: 4 },
  fields: { flex: 1 },
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, minHeight: 48,
    borderWidth: 1, borderColor: 'transparent',
  },
  fieldActive: { borderColor: colors.gray300, backgroundColor: '#fff' },
  fieldInput: { flex: 1, fontSize: 16, color: '#000', paddingVertical: 13, letterSpacing: -0.1 },
  gpsBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm,
  },
  gpsBadgeText: { fontSize: 14, color: '#000' },

  // Results
  list: { flex: 1, paddingHorizontal: spacing.screen },

  gpsRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
  },
  gpsIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  gpsIconText: { fontSize: 16, color: '#000' },

  loadingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 20, justifyContent: 'center', gap: 8,
  },
  loadingText: { fontSize: 14, color: colors.gray400 },

  resultRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
  },
  resultIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  resultDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gray400 },
  resultMain: { fontSize: 16, fontWeight: '500', color: '#000', letterSpacing: -0.1 },
  resultSub: { fontSize: 13, color: colors.gray500, marginTop: 2 },

  noResults: { paddingVertical: 40, alignItems: 'center' },
  noResultsText: { fontSize: 14, color: colors.gray400 },

  // Confirm
  confirmBar: {
    paddingHorizontal: spacing.screen, paddingTop: spacing.xl,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200,
  },
  confirmRoute: { marginBottom: spacing.xl },
  confirmLabel: { fontSize: 11, fontWeight: '600', color: colors.gray400, letterSpacing: 0.8, marginBottom: 2 },
  confirmAddr: { fontSize: 15, fontWeight: '500', color: '#000', letterSpacing: -0.1 },
  confirmDivider: { height: 12 },
  confirmBtn: {
    backgroundColor: '#000', borderRadius: 14,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { fontSize: 17, fontWeight: '600', color: '#fff', letterSpacing: 0.1 },
});
