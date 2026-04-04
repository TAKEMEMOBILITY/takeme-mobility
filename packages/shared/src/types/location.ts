export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationWithAddress extends Coordinates {
  address: string;
}

export interface DriverLocation {
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed_kmh: number | null;
  updated_at: string;
}

export interface RouteInfo {
  distance_km: number;
  duration_min: number;
  polyline: string;
}
