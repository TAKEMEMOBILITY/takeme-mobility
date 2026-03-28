'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME DRIVER — Minimal PWA
//
// Modes:
//   offline   → toggle to go online
//   online    → waiting for ride assignment (Realtime subscription)
//   assigned  → ride details + accept/reject
//   arriving  → navigating to pickup
//   arrived   → waiting for passenger
//   on_trip   → navigating to dropoff
//   completed → ride summary
// ═══════════════════════════════════════════════════════════════════════════

type DriverMode = 'loading' | 'offline' | 'online' | 'assigned' | 'arriving' | 'arrived' | 'on_trip' | 'completed';

interface DriverProfile {
  id: string;
  status: string;
  full_name: string;
  rating: number;
  total_trips: number;
}

interface ActiveRide {
  id: string;
  status: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  vehicle_class: string;
  distance_km: number;
  duration_min: number;
  estimated_fare: number;
  currency: string;
  rider_name: string;
  rider_rating: number;
}

// ── Location tracking ────────────────────────────────────────────────────

function useDriverLocation(isOnline: boolean, interval = 8000) {
  const watchRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!isOnline || !navigator.geolocation) return;

    function sendLocation(lat: number, lng: number, heading?: number, speed?: number) {
      lastPos.current = { lat, lng };
      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          heading: heading ?? undefined,
          speedKmh: speed ? speed * 3.6 : undefined, // m/s → km/h
        }),
      }).catch(() => {}); // non-blocking
    }

    // Watch position
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        sendLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.heading ?? undefined,
          pos.coords.speed ?? undefined,
        );
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );

    // Fallback: if watch doesn't fire often enough, poll
    timerRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { maximumAge: 10000 },
      );
    }, interval);

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOnline, interval]);

  return lastPos;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function DriverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<DriverMode>('loading');
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [ride, setRide] = useState<ActiveRide | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const isOnline = mode !== 'offline' && mode !== 'loading';
  useDriverLocation(isOnline);

  // ── Fetch driver profile ──────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    const res = await fetch('/api/driver/status');
    if (!res.ok) {
      if (res.status === 404) setError('No driver profile found for this account.');
      setMode('offline');
      return null;
    }
    const data = await res.json();
    setProfile(data.driver);
    return data.driver as DriverProfile;
  }, []);

  // ── Fetch active ride ─────────────────────────────────────────────
  const fetchRide = useCallback(async () => {
    const res = await fetch('/api/driver/rides');
    if (!res.ok) return null;
    const data = await res.json();
    return data.ride as ActiveRide | null;
  }, []);

  // ── Determine mode from profile + ride ────────────────────────────
  const resolveMode = useCallback((prof: DriverProfile | null, activeRide: ActiveRide | null) => {
    if (!prof) { setMode('offline'); return; }

    if (activeRide) {
      const statusMap: Record<string, DriverMode> = {
        driver_assigned: 'assigned',
        driver_arriving: 'arriving',
        arrived: 'arrived',
        in_progress: 'on_trip',
        completed: 'completed',
      };
      setMode(statusMap[activeRide.status] ?? 'online');
      setRide(activeRide);
      return;
    }

    setMode(prof.status === 'available' ? 'online' : 'offline');
  }, []);

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/auth/login'); return; }

    async function init() {
      const prof = await fetchProfile();
      const activeRide = await fetchRide();
      resolveMode(prof, activeRide);
    }
    init();
  }, [authLoading, user, router, fetchProfile, fetchRide, resolveMode]);

  // ── Realtime: listen for ride assignments ──────────────────────────
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`driver-rides-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `assigned_driver_id=eq.${profile.id}`,
        },
        async (payload: { eventType: string }) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updatedRide = await fetchRide();
            if (updatedRide) {
              resolveMode(profile, updatedRide);
            }
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, supabase, fetchRide, resolveMode, profile]);

  // ── Toggle online/offline ─────────────────────────────────────────
  const toggleOnline = useCallback(async () => {
    setActionLoading(true);
    setError('');
    try {
      const newStatus = mode === 'offline' ? 'available' : 'offline';
      const res = await fetch('/api/driver/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      setMode(newStatus === 'available' ? 'online' : 'offline');
      if (profile) setProfile({ ...profile, status: newStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  }, [mode, profile]);

  // ── Ride actions ──────────────────────────────────────────────────
  const rideAction = useCallback(async (action: string, cancelReason?: string) => {
    if (!ride) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/driver/rides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: ride.id,
          action,
          ...(cancelReason ? { cancelReason } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      // Re-fetch to get updated state
      const updatedRide = await fetchRide();
      resolveMode(profile, updatedRide);

      // If completed or cancelled, clear after a moment
      if (data.status === 'completed' || data.status === 'cancelled') {
        setTimeout(() => {
          setRide(null);
          setMode('online');
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }, [ride, fetchRide, resolveMode, profile]);

  // ── Render helpers ────────────────────────────────────────────────

  if (authLoading || mode === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E8E8ED] border-t-[#1D1D1F]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1D1D1F]">

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-[#F5F5F7] px-5 py-4">
        <div>
          <p className="text-[18px] font-semibold tracking-[-0.01em]">TakeMe Driver</p>
          {profile && (
            <p className="text-[13px] text-[#86868B]">
              {profile.full_name} · ★ {Number(profile.rating).toFixed(1)} · {profile.total_trips} trips
            </p>
          )}
        </div>
        <div className={`h-3 w-3 rounded-full ${
          isOnline ? 'bg-[#34C759]' : 'bg-[#E8E8ED]'
        }`} />
      </header>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="mx-5 mt-4 flex items-center gap-2.5 rounded-xl bg-[#FFF5F5] px-4 py-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF3B30]" />
          <p className="text-[13px] font-medium">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-[12px] text-[#86868B]">Dismiss</button>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col p-5">

        {/* ═══ OFFLINE ════════════════════════════════════════ */}
        {mode === 'offline' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F5F5F7]">
              <svg className="h-8 w-8 text-[#86868B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[20px] font-semibold">You're offline</p>
              <p className="mt-1 text-[15px] text-[#86868B]">Go online to start receiving ride requests</p>
            </div>
            <button
              onClick={toggleOnline}
              disabled={actionLoading}
              className="h-[56px] w-full max-w-xs rounded-[999px] bg-[#34C759] text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-[#2DB84E] disabled:opacity-50"
            >
              {actionLoading ? 'Going online...' : 'Go online'}
            </button>
          </div>
        )}

        {/* ═══ ONLINE — waiting ═══════════════════════════════ */}
        {mode === 'online' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="h-20 w-20 rounded-full bg-[#34C759]/10" />
              <div className="absolute h-12 w-12 animate-ping rounded-full bg-[#34C759] opacity-10" />
              <div className="absolute h-4 w-4 rounded-full bg-[#34C759]" />
            </div>
            <div className="text-center">
              <p className="text-[20px] font-semibold">You're online</p>
              <p className="mt-1 text-[15px] text-[#86868B]">Waiting for ride requests</p>
            </div>
            <button
              onClick={toggleOnline}
              disabled={actionLoading}
              className="h-[48px] w-full max-w-xs rounded-[999px] border border-[#E8E8ED] text-[15px] font-medium text-[#86868B] transition-colors duration-200 hover:bg-[#F5F5F7] disabled:opacity-50"
            >
              {actionLoading ? 'Going offline...' : 'Go offline'}
            </button>
          </div>
        )}

        {/* ═══ RIDE ACTIVE — assigned/arriving/arrived/on_trip ═ */}
        {ride && (mode === 'assigned' || mode === 'arriving' || mode === 'arrived' || mode === 'on_trip') && (
          <div className="flex flex-1 flex-col gap-5">

            {/* Phase indicator */}
            <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F7] px-4 py-3.5">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0071E3] opacity-30" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#0071E3]" />
              </span>
              <span className="text-[15px] font-semibold">
                {mode === 'assigned' && 'New ride request'}
                {mode === 'arriving' && 'Heading to pickup'}
                {mode === 'arrived' && 'Waiting for passenger'}
                {mode === 'on_trip' && 'Trip in progress'}
              </span>
            </div>

            {/* Rider info */}
            <div className="flex items-center gap-4 rounded-xl border border-[#F5F5F7] p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F5F7] text-[18px] font-bold">
                {ride.rider_name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-[16px] font-semibold">{ride.rider_name}</p>
                <p className="text-[13px] text-[#86868B]">★ {Number(ride.rider_rating).toFixed(1)} · {ride.vehicle_class}</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-bold tabular-nums">${Number(ride.estimated_fare).toFixed(2)}</p>
                <p className="text-[12px] text-[#86868B]">{ride.distance_km} km · {ride.duration_min} min</p>
              </div>
            </div>

            {/* Route */}
            <div className="space-y-2">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3.5 ${
                mode === 'on_trip' ? 'bg-[#F5F5F7]' : 'bg-[#34C759]/8 border border-[#34C759]/20'
              }`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#34C759]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Pickup</p>
                  <p className="mt-0.5 truncate text-[15px] font-medium">{ride.pickup_address}</p>
                </div>
                {(mode === 'assigned' || mode === 'arriving') && (
                  <a
                    href={`https://maps.google.com/maps?daddr=${ride.pickup_lat},${ride.pickup_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0071E3] text-white"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  </a>
                )}
              </div>

              <div className={`flex items-center gap-3 rounded-xl px-4 py-3.5 ${
                mode === 'on_trip' ? 'bg-[#0071E3]/8 border border-[#0071E3]/20' : 'bg-[#F5F5F7]'
              }`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1D1D1F]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868B]">Dropoff</p>
                  <p className="mt-0.5 truncate text-[15px] font-medium">{ride.dropoff_address}</p>
                </div>
                {mode === 'on_trip' && (
                  <a
                    href={`https://maps.google.com/maps?daddr=${ride.dropoff_lat},${ride.dropoff_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0071E3] text-white"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-auto space-y-3">
              {mode === 'assigned' && (
                <>
                  <button
                    onClick={() => rideAction('accept')}
                    disabled={actionLoading}
                    className="flex h-[56px] w-full items-center justify-center rounded-[999px] bg-[#34C759] text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-[#2DB84E] disabled:opacity-50"
                  >
                    {actionLoading ? 'Accepting...' : 'Accept ride'}
                  </button>
                  <button
                    onClick={() => rideAction('cancel', 'Driver rejected')}
                    disabled={actionLoading}
                    className="flex h-[48px] w-full items-center justify-center rounded-[999px] border border-[#E8E8ED] text-[15px] font-medium text-[#86868B] transition-colors duration-200 hover:bg-[#F5F5F7] disabled:opacity-50"
                  >
                    Decline
                  </button>
                </>
              )}

              {mode === 'arriving' && (
                <button
                  onClick={() => rideAction('arrived')}
                  disabled={actionLoading}
                  className="flex h-[56px] w-full items-center justify-center rounded-[999px] bg-[#1D1D1F] text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-[#424245] disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : 'I\'ve arrived'}
                </button>
              )}

              {mode === 'arrived' && (
                <button
                  onClick={() => rideAction('start_trip')}
                  disabled={actionLoading}
                  className="flex h-[56px] w-full items-center justify-center rounded-[999px] bg-[#0071E3] text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-[#005BB5] disabled:opacity-50"
                >
                  {actionLoading ? 'Starting...' : 'Start trip'}
                </button>
              )}

              {mode === 'on_trip' && (
                <button
                  onClick={() => rideAction('complete')}
                  disabled={actionLoading}
                  className="flex h-[56px] w-full items-center justify-center rounded-[999px] bg-[#34C759] text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-[#2DB84E] disabled:opacity-50"
                >
                  {actionLoading ? 'Completing...' : 'Complete trip'}
                </button>
              )}

              {/* Cancel available during arriving/arrived */}
              {(mode === 'arriving' || mode === 'arrived') && (
                <button
                  onClick={() => rideAction('cancel', 'Driver cancelled')}
                  disabled={actionLoading}
                  className="flex h-[44px] w-full items-center justify-center rounded-[999px] text-[14px] font-medium text-[#FF3B30] transition-colors duration-200 hover:bg-[#FFF5F5] disabled:opacity-50"
                >
                  Cancel ride
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══ COMPLETED ══════════════════════════════════════ */}
        {mode === 'completed' && ride && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#34C759]/10">
              <svg className="h-8 w-8 text-[#34C759]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[22px] font-semibold">Trip complete</p>
              <p className="mt-1 text-[15px] text-[#86868B]">{ride.rider_name} · {ride.distance_km} km</p>
            </div>
            <p className="text-[28px] font-bold tabular-nums">${Number(ride.estimated_fare).toFixed(2)}</p>
          </div>
        )}
      </main>
    </div>
  );
}
