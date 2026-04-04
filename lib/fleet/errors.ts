export enum FleetErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  INVALID_STATUS = 'INVALID_STATUS',
  INVALID_DATES = 'INVALID_DATES',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  VEHICLE_UNAVAILABLE = 'VEHICLE_UNAVAILABLE',
  DRIVER_INELIGIBLE = 'DRIVER_INELIGIBLE',
  KYC_REQUIRED = 'KYC_REQUIRED',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  DB_ERROR = 'DB_ERROR',
  CONFLICT = 'CONFLICT',
}

export class FleetError extends Error {
  constructor(
    public readonly code: FleetErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'FleetError'
  }
}
