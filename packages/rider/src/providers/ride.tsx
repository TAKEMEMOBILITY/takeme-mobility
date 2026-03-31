import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type {
  Ride,
  RideStatus,
  AssignedDriverInfo,
  Coordinates,
} from '@takeme/shared';
import { ACTIVE_RIDE_STATUSES, ApiClient, API } from '@takeme/shared';
import { useSupabase } from './supabase';
import { useAuth } from './auth';

interface RideState {
  activeRide: Ride | null;
  assignedDriver: AssignedDriverInfo | null;
  driverLocation: Coordinates | null;
  loading: boolean;
  error: string | null;
}

type RideAction =
  | { type: 'SET_RIDE'; ride: Ride | null }
  | { type: 'SET_DRIVER'; driver: AssignedDriverInfo | null }
  | { type: 'SET_DRIVER_LOCATION'; location: Coordinates | null }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'CLEAR' };

function rideReducer(state: RideState, action: RideAction): RideState {
  switch (action.type) {
    case 'SET_RIDE':
      return { ...state, activeRide: action.ride, error: null };
    case 'SET_DRIVER':
      return { ...state, assignedDriver: action.driver };
    case 'SET_DRIVER_LOCATION':
      return { ...state, driverLocation: action.location };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
}

const initialState: RideState = {
  activeRide: null,
  assignedDriver: null,
  driverLocation: null,
  loading: false,
  error: null,
};

interface RideContextValue extends RideState {
  restoreActiveRide: () => Promise<void>;
  setActiveRide: (ride: Ride) => void;
  cancelRide: () => Promise<void>;
  clearRide: () => void;
}

const RideContext = createContext<RideContextValue | null>(null);

export function RideProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(rideReducer, initialState);

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

  // Set active ride (called by quotes.tsx after ride creation)
  const setActiveRide = useCallback((ride: Ride) => {
    dispatch({ type: 'SET_RIDE', ride });
  }, []);

  // Fetch assigned driver details from DB
  const fetchAssignedDriver = useCallback(async (driverId: string) => {
    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, full_name, phone, rating, avatar_url')
        .eq('id', driverId)
        .single();

      if (!driver) return;

      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('make, model, year, color, plate_number, vehicle_class')
        .eq('driver_id', driverId)
        .eq('is_active', true)
        .limit(1)
        .single();

      const driverInfo: AssignedDriverInfo = {
        id: driver.id,
        full_name: driver.full_name,
        phone: driver.phone,
        rating: Number(driver.rating),
        avatar_url: driver.avatar_url,
        vehicle: vehicle ? {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          plate_number: vehicle.plate_number,
          vehicle_class: vehicle.vehicle_class,
        } : { make: '', model: '', year: 0, color: '', plate_number: '', vehicle_class: 'economy' as const },
      };

      dispatch({ type: 'SET_DRIVER', driver: driverInfo });
    } catch (err) {
      console.error('Failed to fetch driver info:', err);
    }
  }, [supabase]);

  // Fetch driver location
  const fetchDriverLocation = useCallback(async (driverId: string) => {
    try {
      const { data } = await supabase
        .from('driver_locations')
        .select('location, heading')
        .eq('driver_id', driverId)
        .single();

      if (data?.location) {
        const loc = data.location as unknown;
        let lat: number | null = null;
        let lng: number | null = null;

        if (typeof loc === 'object' && loc !== null) {
          const geo = loc as { coordinates?: number[] };
          if (geo.coordinates && geo.coordinates.length >= 2) {
            lng = geo.coordinates[0];
            lat = geo.coordinates[1];
          }
        } else if (typeof loc === 'string') {
          const match = (loc as string).match(/POINT\(([^ ]+) ([^ ]+)\)/);
          if (match) {
            lng = parseFloat(match[1]);
            lat = parseFloat(match[2]);
          }
        }

        if (lat !== null && lng !== null) {
          dispatch({ type: 'SET_DRIVER_LOCATION', location: { latitude: lat, longitude: lng } });
        }
      }
    } catch (err) {
      console.error('Failed to fetch driver location:', err);
    }
  }, [supabase]);

  // Cancel ride
  const cancelRide = useCallback(async () => {
    if (!state.activeRide || !apiClient) return;
    try {
      await apiClient.post(API.RIDES_CANCEL, { rideId: state.activeRide.id });
      dispatch({ type: 'CLEAR' });
    } catch (err) {
      console.error('Failed to cancel ride:', err);
    }
  }, [state.activeRide, apiClient]);

  // Restore active ride on app launch
  const restoreActiveRide = useCallback(async () => {
    if (!user) return;
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', user.id)
        .in('status', ACTIVE_RIDE_STATUSES)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      dispatch({ type: 'SET_RIDE', ride: data });

      if (data?.assigned_driver_id) {
        await fetchAssignedDriver(data.assigned_driver_id);
        await fetchDriverLocation(data.assigned_driver_id);
      }
    } catch (err) {
      console.error('Failed to restore active ride:', err);
      dispatch({ type: 'SET_ERROR', error: 'Failed to restore ride' });
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [user, supabase, fetchAssignedDriver, fetchDriverLocation]);

  const clearRide = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  // Subscribe to realtime ride status changes
  useEffect(() => {
    if (!state.activeRide) return;

    const channel = supabase
      .channel(`ride:${state.activeRide.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${state.activeRide.id}`,
        },
        async (payload) => {
          const updated = payload.new as Ride;
          dispatch({ type: 'SET_RIDE', ride: updated });

          // Fetch driver info when first assigned
          if (updated.assigned_driver_id && !state.assignedDriver) {
            await fetchAssignedDriver(updated.assigned_driver_id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.activeRide?.id, supabase, state.assignedDriver, fetchAssignedDriver]);

  // Subscribe to driver location updates via Realtime
  useEffect(() => {
    if (!state.activeRide?.assigned_driver_id) return;
    const driverId = state.activeRide.assigned_driver_id;

    // Initial fetch
    fetchDriverLocation(driverId);

    const channel = supabase
      .channel(`driver_loc:${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const loc = row.location as unknown;
          let lat: number | null = null;
          let lng: number | null = null;

          if (typeof loc === 'object' && loc !== null) {
            const geo = loc as { coordinates?: number[] };
            if (geo.coordinates && geo.coordinates.length >= 2) {
              lng = geo.coordinates[0];
              lat = geo.coordinates[1];
            }
          } else if (typeof loc === 'string') {
            const match = (loc as string).match(/POINT\(([^ ]+) ([^ ]+)\)/);
            if (match) {
              lng = parseFloat(match[1]);
              lat = parseFloat(match[2]);
            }
          }

          if (lat !== null && lng !== null) {
            dispatch({ type: 'SET_DRIVER_LOCATION', location: { latitude: lat, longitude: lng } });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.activeRide?.assigned_driver_id, supabase, fetchDriverLocation]);

  // Restore on login
  useEffect(() => {
    if (user) {
      restoreActiveRide();
    } else {
      dispatch({ type: 'CLEAR' });
    }
  }, [user, restoreActiveRide]);

  const value = useMemo(
    () => ({ ...state, restoreActiveRide, setActiveRide, cancelRide, clearRide }),
    [state, restoreActiveRide, setActiveRide, cancelRide, clearRide],
  );

  return (
    <RideContext.Provider value={value}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide(): RideContextValue {
  const ctx = useContext(RideContext);
  if (!ctx) {
    throw new Error('useRide must be used within a RideProvider');
  }
  return ctx;
}
