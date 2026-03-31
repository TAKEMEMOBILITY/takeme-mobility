import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { estimateRoute, routeFromDirections, calculateFares } from '@/lib/pricing';
import { useAirportDetection } from '@/hooks/useAirportDetection';
import { usePayment } from '@/hooks/usePayment';
import { useRide } from '@/providers/ride';
import { ApiClient, API } from '@takeme/shared';
import { useSupabase } from '@/providers/supabase';
import {
  RiderTypeSelector, type RideFor,
  AirportRideSection,
  ReservationFields, type ScheduleMode,
  PaymentMethod,
} from '@/components/booking';

function usd(n: number) { return `$${n.toFixed(2)}`; }

function parseCoord(val: string | string[] | undefined): number | null {
  const raw = Array.isArray(val) ? val[0] : val;
  if (!raw) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function str(val: string | string[] | undefined): string {
  return (Array.isArray(val) ? val[0] : val) ?? '';
}

export default function QuotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  // ── Parse route params ──
  const pickupLat = parseCoord(params.pickupLat);
  const pickupLng = parseCoord(params.pickupLng);
  const dropoffLat = parseCoord(params.dropoffLat);
  const dropoffLng = parseCoord(params.dropoffLng);
  const pickupLabel = str(params.pickupLabel) || 'Pickup';
  const dropoffLabel = str(params.dropoffLabel) || 'Destination';
  const routeSource = str(params.routeSource) || 'haversine';
  const dirDistanceMi = parseCoord(params.routeDistanceMi);
  const dirDurationMin = parseCoord(params.routeDurationMin);

  const hasCoords = pickupLat !== null && pickupLng !== null && dropoffLat !== null && dropoffLng !== null;

  // ── Local booking state ──
  const [selected, setSelected] = useState(0);

  // Rider type
  const [rideFor, setRideFor] = useState<RideFor>('me');
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [driverNotes, setDriverNotes] = useState('');
  const [meetGreet, setMeetGreet] = useState(false);
  const [nameSign, setNameSign] = useState(false);

  // Airport
  const { isAirport } = useAirportDetection(pickupLabel, dropoffLabel);
  const [airline, setAirline] = useState('');
  const [flightNumber, setFlightNumber] = useState('');

  // Reservation
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('now');
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [scheduleTime, setScheduleTime] = useState(new Date());

  // Payment
  const payment = usePayment();
  const { setActiveRide } = useRide();
  const supabase = useSupabase();
  const [booking, setBooking] = useState(false);

  const apiClient = useMemo(() => {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!baseUrl) return null;
    return new ApiClient({
      baseUrl,
      getAccessToken: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
  }, [supabase]);

  // ── Compute route + fares ──
  const result = useMemo(() => {
    if (!hasCoords) return null;
    let route;
    if (routeSource === 'directions' && dirDistanceMi !== null && dirDurationMin !== null) {
      route = routeFromDirections(dirDistanceMi, dirDurationMin);
    } else {
      route = estimateRoute(
        { latitude: pickupLat!, longitude: pickupLng! },
        { latitude: dropoffLat!, longitude: dropoffLng! },
      );
    }
    return { route, quotes: calculateFares(route) };
  }, [hasCoords, pickupLat, pickupLng, dropoffLat, dropoffLng, routeSource, dirDistanceMi, dirDurationMin]);

  // ── Loading ──
  if (!hasCoords) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not calculate fares.</Text>
          <Pressable style={styles.errorBtn} onPress={() => router.back()}>
            <Text style={styles.errorBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { route, quotes } = result;
  const q = quotes[selected];

  const handleRequest = async () => {
    if (booking) return;
    setBooking(true);

    try {
      // 1. Authorize payment via Stripe PaymentSheet
      const payResult = await payment.requestPayment(q.totalFare);

      if (!payResult.success) {
        if (payResult.error === 'cancelled') { setBooking(false); return; }
        if (payResult.error !== 'Stripe not configured') {
          Alert.alert('Payment failed', payResult.error ?? 'Please try again.');
          setBooking(false);
          return;
        }
      }

      // 2. Create ride via API
      // Map vehicle classes: rider pricing uses extended classes, backend expects economy/comfort/premium
      const classMap: Record<string, string> = {
        electric: 'economy', comfort_electric: 'comfort', premium_electric: 'premium',
        suv_electric: 'premium', women_rider: 'economy', pet_ride: 'economy',
        economy: 'economy', comfort: 'comfort', premium: 'premium',
      };
      const backendClass = classMap[q.vehicleClass] ?? 'economy';

      if (apiClient) {
        try {
          const response = await apiClient.post<{
            ride: { id: string; status: string; estimatedFare: number; currency: string; requestedAt: string };
            payment: { clientSecret: string; paymentIntentId: string } | null;
            driver: { name: string; vehicle: string; plate: string } | null;
          }>(API.RIDES_CREATE, {
            pickupAddress: pickupLabel,
            pickupLat,
            pickupLng,
            dropoffAddress: dropoffLabel,
            dropoffLat,
            dropoffLng,
            distanceKm: route.distanceKm,
            durationMin: Math.round(route.durationMin),
            vehicleClass: backendClass,
            baseFare: q.baseFare,
            distanceFare: q.distanceFare,
            timeFare: q.timeFare,
            totalFare: q.totalFare,
            surgeMultiplier: 1.0,
          });

          // Set the ride in provider so Realtime subscriptions kick in
          setActiveRide({
            id: response.ride.id,
            status: response.ride.status as 'searching_driver',
            pickup_address: pickupLabel,
            pickup_lat: pickupLat!,
            pickup_lng: pickupLng!,
            dropoff_address: dropoffLabel,
            dropoff_lat: dropoffLat!,
            dropoff_lng: dropoffLng!,
            distance_km: route.distanceKm,
            duration_min: Math.round(route.durationMin),
            estimated_fare: q.totalFare,
            vehicle_class: backendClass,
          } as any);

          router.push({
            pathname: '/(app)/ride/searching',
            params: { rideId: response.ride.id },
          });
          return;
        } catch (err) {
          console.error('[quotes] Ride creation failed:', err);
          Alert.alert('Booking failed', 'Could not create ride. Please try again.');
          setBooking(false);
          return;
        }
      }

      // Fallback if no API client (dev mode without API_BASE_URL)
      router.push({
        pathname: '/(app)/ride/searching',
        params: { vehicleClass: q.vehicleClass, fare: q.totalFare.toString(), dropoffLabel },
      });
    } finally {
      setBooking(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header onBack={() => router.back()} />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingBottom: 260 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Route summary ── */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeDots}>
              <View style={[styles.routeDot, { backgroundColor: '#000' }]} />
              <View style={styles.routeLine} />
              <View style={[styles.routeDot, { backgroundColor: '#A0A0A0' }]} />
            </View>
            <View style={styles.routeLabels}>
              <Text style={styles.routeAddr} numberOfLines={1}>{pickupLabel}</Text>
              <View style={{ height: 16 }} />
              <Text style={styles.routeAddr} numberOfLines={1}>{dropoffLabel}</Text>
            </View>
          </View>
          <View style={styles.routeStats}>
            <Text style={styles.routeStat}>{route.distanceMi.toFixed(1)} mi</Text>
            <Text style={styles.routeStatDot}>{'\u00B7'}</Text>
            <Text style={styles.routeStat}>{Math.round(route.durationMin)} min</Text>
            {route.source === 'haversine' && (
              <>
                <Text style={styles.routeStatDot}>{'\u00B7'}</Text>
                <Text style={[styles.routeStat, { color: '#C0C0C0' }]}>estimated</Text>
              </>
            )}
          </View>
        </View>

        {/* ── Reservation ── */}
        <View style={styles.pad}>
          <ReservationFields
            mode={scheduleMode}
            onModeChange={setScheduleMode}
            date={scheduleDate}
            onDateChange={setScheduleDate}
            time={scheduleTime}
            onTimeChange={setScheduleTime}
          />
        </View>

        {/* ── Rider type ── */}
        <View style={styles.pad}>
          <RiderTypeSelector
            value={rideFor}
            onChange={setRideFor}
            passengerName={passengerName}
            onPassengerNameChange={setPassengerName}
            passengerPhone={passengerPhone}
            onPassengerPhoneChange={setPassengerPhone}
            driverNotes={driverNotes}
            onDriverNotesChange={setDriverNotes}
            meetGreet={meetGreet}
            onMeetGreetChange={setMeetGreet}
            nameSign={nameSign}
            onNameSignChange={setNameSign}
          />
        </View>

        {/* ── Airport section (conditional) ── */}
        {isAirport && (
          <View style={styles.pad}>
            <AirportRideSection
              airline={airline}
              onAirlineChange={setAirline}
              flightNumber={flightNumber}
              onFlightNumberChange={setFlightNumber}
            />
          </View>
        )}

        {/* ── Payment method ── */}
        <View style={styles.pad}>
          <PaymentMethod
            lastMethod={payment.lastPaymentMethod}
            loading={payment.loading}
            onAddPayment={() => payment.requestPayment(q?.totalFare ?? 0)}
          />
        </View>

        {/* ── Section label ── */}
        <View style={styles.pad}>
          <Text style={styles.sectionLabel}>SELECT RIDE</Text>
        </View>

        {/* ── Vehicle cards ── */}
        <View style={styles.pad}>
          {quotes.map((item, i) => {
            const active = selected === i;
            return (
              <Pressable
                key={item.vehicleClass}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => setSelected(i)}
              >
                <View style={styles.cardLeft}>
                  <Text style={[styles.cardLabel, active && styles.cardLabelActive]}>
                    {item.label}
                  </Text>
                  <Text style={styles.cardDesc}>{item.description}</Text>
                  <Text style={styles.cardCap}>{item.capacity} seats</Text>
                </View>
                <Text style={[styles.cardPrice, active && styles.cardPriceActive]}>
                  {usd(item.totalFare)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Bottom bar ── */}
      {q && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.breakdownWrap}>
            <BRow label="Base" val={usd(q.baseFare)} />
            <BRow label={`Distance (${route.distanceMi.toFixed(1)} mi)`} val={usd(q.distanceFare)} />
            <BRow label={`Time (${Math.round(route.durationMin)} min)`} val={usd(q.timeFare)} />
            {q.totalFare === q.minFare && (
              <BRow label="Minimum fare applied" val={usd(q.minFare)} muted />
            )}
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Estimated fare</Text>
            <Text style={styles.totalValue}>{usd(q.totalFare)}</Text>
          </View>

          <Pressable style={[styles.cta, booking && { opacity: 0.6 }]} onPress={handleRequest} disabled={booking}>
            <Text style={styles.ctaText}>
              {booking ? 'Booking...' : `Request ${q.label} — ${usd(q.totalFare)}`}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.backText}>{'\u2190'}</Text>
      </Pressable>
      <Text style={styles.headerTitle}>Plan your ride</Text>
      <View style={{ width: 28 }} />
    </View>
  );
}

function BRow({ label, val, muted }: { label: string; val: string; muted?: boolean }) {
  return (
    <View style={styles.bRow}>
      <Text style={[styles.bLabel, muted && { fontStyle: 'italic' }]}>{label}</Text>
      <Text style={styles.bVal}>{val}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  scrollArea: { flex: 1 },
  pad: { paddingHorizontal: 24 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
  },
  backText: { fontSize: 28, color: '#000', fontWeight: '300' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#000', letterSpacing: -0.2 },

  // Route card
  routeCard: {
    margin: 24, marginBottom: 8,
    padding: 20, borderRadius: 14,
    backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F0F0F0',
  },
  routeRow: { flexDirection: 'row' },
  routeDots: { alignItems: 'center', paddingTop: 5, marginRight: 14, width: 12 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 1.5, flex: 1, backgroundColor: '#E0E0E0', marginVertical: 3 },
  routeLabels: { flex: 1 },
  routeAddr: { fontSize: 15, fontWeight: '500', color: '#000', letterSpacing: -0.1 },
  routeStats: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14,
    paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8E8',
  },
  routeStat: { fontSize: 13, fontWeight: '500', color: '#666' },
  routeStatDot: { fontSize: 13, color: '#CCC', marginHorizontal: 6 },

  // Section label
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#A0A0A0', letterSpacing: 1, marginBottom: 12 },

  // Vehicle cards
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: 20,
    borderRadius: 14, marginBottom: 6,
    backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: 'transparent',
  },
  cardActive: {
    backgroundColor: '#fff', borderColor: '#E0E0E0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardLeft: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: '500', color: '#000', letterSpacing: -0.1 },
  cardLabelActive: { fontWeight: '600' },
  cardDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  cardCap: { fontSize: 12, color: '#AAA', marginTop: 4 },
  cardPrice: { fontSize: 18, fontWeight: '600', color: '#000', marginLeft: 16 },
  cardPriceActive: { color: '#000' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8E8',
    paddingHorizontal: 24, paddingTop: 18,
  },
  breakdownWrap: { marginBottom: 8 },
  bRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  bLabel: { fontSize: 13, color: '#888' },
  bVal: { fontSize: 13, color: '#000' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8E8',
    paddingTop: 12, marginBottom: 18,
  },
  totalLabel: { fontSize: 15, fontWeight: '500', color: '#000' },
  totalValue: { fontSize: 20, fontWeight: '700', color: '#000', letterSpacing: -0.3 },

  cta: { backgroundColor: '#000', borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '600', color: '#fff', letterSpacing: 0.1 },

  errorText: { fontSize: 15, color: '#888', marginBottom: 20 },
  errorBtn: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  errorBtnText: { fontSize: 14, fontWeight: '500', color: '#000' },
});
