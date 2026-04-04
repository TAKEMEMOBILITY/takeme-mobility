import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as Location from 'expo-location';

interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Seattle center — default fallback */
const SEATTLE: Coordinates = { latitude: 47.6062, longitude: -122.3321 };

interface LocationState {
  location: Coordinates | null;
  permissionGranted: boolean | null;
  loading: boolean;
  error: string | null;
}

interface LocationContextValue extends LocationState {
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocationState>({
    location: null,
    permissionGranted: null,
    loading: true,
    error: null,
  });

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setState((prev) => ({ ...prev, permissionGranted: granted }));
    return granted;
  }, []);

  const refreshLocation = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setState((prev) => ({
        ...prev,
        location: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
        loading: false,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        location: SEATTLE,
        loading: false,
        error: 'Could not get current location',
      }));
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === 'granted';
      setState((prev) => ({ ...prev, permissionGranted: granted }));

      if (granted) {
        await refreshLocation();
      } else {
        // Default to Seattle if no permission yet
        setState((prev) => ({ ...prev, location: SEATTLE, loading: false }));
      }
    })();
  }, [refreshLocation]);

  return (
    <LocationContext.Provider value={{ ...state, requestPermission, refreshLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within a LocationProvider');
  return ctx;
}
