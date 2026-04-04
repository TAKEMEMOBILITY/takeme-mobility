import type { VehicleClass } from './ride';

export type DriverStatus = 'offline' | 'available' | 'busy' | 'on_trip';

export type DriverApplicationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type DocumentType =
  | 'license_front'
  | 'license_back'
  | 'insurance'
  | 'registration'
  | 'profile_photo'
  | 'background_check';

export type DocumentStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Driver {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  license_number: string | null;
  status: DriverStatus;
  rating: number;
  total_trips: number;
  is_verified: boolean;
  is_active: boolean;
  accepts_pets: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  vehicle_class: VehicleClass;
  make: string;
  model: string;
  year: number;
  color: string;
  plate_number: string;
  capacity: number;
  is_active: boolean;
}

export interface DriverApplication {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
  license_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_color: string;
  plate_number: string;
  vehicle_class: VehicleClass;
  status: DriverApplicationStatus;
  background_check_status: string | null;
  documents_complete: boolean;
  created_at: string;
}

export interface DriverDocument {
  id: string;
  driver_id: string;
  doc_type: DocumentType;
  file_url: string;
  status: DocumentStatus;
  expires_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

/** Driver info exposed to rider after assignment */
export interface AssignedDriverInfo {
  id: string;
  full_name: string;
  phone: string;
  rating: number;
  avatar_url: string | null;
  vehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    plate_number: string;
    vehicle_class: VehicleClass;
  };
}
