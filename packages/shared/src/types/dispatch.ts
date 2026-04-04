import type { AssignedDriverInfo } from './driver';

export interface DispatchRequest {
  ride_id: string;
}

export interface DispatchResponse {
  success: boolean;
  ride_id: string;
  driver: AssignedDriverInfo | null;
  message: string;
}

export interface NearbyDriver {
  driver_id: string;
  distance_m: number;
  latitude: number;
  longitude: number;
}
