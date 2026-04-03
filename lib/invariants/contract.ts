import { auditLog } from '@/lib/auth/audit';

// ═══════════════════════════════════════════════════════════════════════════
// INVARIANT 6 — System Contract
//
// Non-negotiable promises TakeMe makes to every user.
// Violation = rejected request + risk_score: 95 + security alert.
// ═══════════════════════════════════════════════════════════════════════════

interface ContractViolation {
  contract: string;
  description: string;
}

/**
 * Validate that a request does not violate system contracts.
 * Returns violations array (empty = all clear).
 */
export function validateContract(
  action: string,
  resource: string,
  metadata?: Record<string, unknown>,
): ContractViolation[] {
  const violations: ContractViolation[] = [];

  // Audit logs are immutable — no UPDATE/DELETE
  if (resource === 'audit_logs' && (action === 'update' || action === 'delete')) {
    violations.push({
      contract: 'AUDIT_IMMUTABILITY',
      description: 'Audit log entries are immutable. UPDATE and DELETE are prohibited.',
    });
  }

  // Payment audit log is immutable
  if (resource === 'payment_audit_log' && action === 'delete') {
    violations.push({
      contract: 'PAYMENT_IMMUTABILITY',
      description: 'Payment audit entries are immutable. DELETE is prohibited.',
    });
  }

  // ride_id is immutable once created
  if (resource === 'rides' && action === 'update' && metadata?.field === 'id') {
    violations.push({
      contract: 'RIDE_ID_IMMUTABILITY',
      description: 'ride_id is globally unique and immutable once created.',
    });
  }

  // Driver earnings cannot decrease without audit
  if (resource === 'driver_earnings' && action === 'decrease' && !metadata?.auditTrail) {
    violations.push({
      contract: 'DRIVER_EARNINGS_PROTECTION',
      description: 'Driver earnings cannot be decreased without explicit audit trail.',
    });
  }

  // Driver deactivation requires 24h notice (except fraud)
  if (resource === 'drivers' && action === 'deactivate' && !metadata?.isFraud && !metadata?.noticeSent) {
    violations.push({
      contract: 'DRIVER_24H_NOTICE',
      description: 'Driver account cannot be deactivated without 24-hour notice (except fraud cases).',
    });
  }

  // Location data must not be stored after ride completion
  if (resource === 'rider_location' && action === 'store' && metadata?.rideCompleted) {
    violations.push({
      contract: 'LOCATION_PRIVACY',
      description: 'Rider location data must not be stored after ride completion.',
    });
  }

  // Payment methods must never be stored in plaintext
  if (resource === 'payment_methods' && action === 'store' && metadata?.plaintext) {
    violations.push({
      contract: 'PAYMENT_SECURITY',
      description: 'Payment method must never be stored in plaintext.',
    });
  }

  return violations;
}

/**
 * Enforce contract: validate and reject if violated.
 * Returns null if OK, or the first violation.
 */
export async function enforceContract(
  action: string,
  resource: string,
  userId?: string,
  request?: Request,
  metadata?: Record<string, unknown>,
): Promise<ContractViolation | null> {
  const violations = validateContract(action, resource, metadata);

  if (violations.length > 0) {
    const v = violations[0];
    await auditLog({
      userId,
      action: 'CONTRACT_VIOLATION',
      resource,
      success: false,
      request,
      riskScore: 95,
      metadata: { contract: v.contract, description: v.description, attemptedAction: action },
    });
    return v;
  }

  return null;
}
