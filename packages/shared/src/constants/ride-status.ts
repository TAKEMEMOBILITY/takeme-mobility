import type { RideStatus } from '../types/ride';

/**
 * Valid state transitions for rides.
 * Key = current status, Value = set of statuses it can transition to.
 * Used for client-side validation and UI state determination.
 */
export const RIDE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  pending: ['quoted', 'searching_driver', 'cancelled'],
  quoted: ['searching_driver', 'cancelled'],
  searching_driver: ['driver_assigned', 'cancelled'],
  driver_assigned: ['driver_arriving', 'cancelled'],
  driver_arriving: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
} as const;

export function canTransitionTo(from: RideStatus, to: RideStatus): boolean {
  return RIDE_TRANSITIONS[from].includes(to);
}

/** Human-readable labels for ride statuses */
export const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  pending: 'Pending',
  quoted: 'Quoted',
  searching_driver: 'Finding Driver',
  driver_assigned: 'Driver Assigned',
  driver_arriving: 'Driver En Route',
  arrived: 'Driver Arrived',
  in_progress: 'Trip In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
