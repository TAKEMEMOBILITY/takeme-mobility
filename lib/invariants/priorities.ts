// ═══════════════════════════════════════════════════════════════════════════
// Invariant Priority Definitions
// ═══════════════════════════════════════════════════════════════════════════

export type InvariantPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM';
export type InvariantName = 'auth' | 'payments' | 'data' | 'resilience' | 'circuit' | 'contract';

export interface PriorityConfig {
  riskScore: number;
  blockOperation: boolean;
  escalateMode: string | null; // target system mode or null
  alertTargets: ('security_owner' | 'ops_core' | 'monitoring')[];
  sendSMS: boolean;
}

export const PRIORITY_CONFIG: Record<InvariantPriority, PriorityConfig> = {
  CRITICAL: {
    riskScore: 95,
    blockOperation: true,
    escalateMode: 'DEFENSIVE', // NORMAL→DEFENSIVE, DEFENSIVE→LOCKDOWN
    alertTargets: ['security_owner', 'ops_core'],
    sendSMS: true,
  },
  HIGH: {
    riskScore: 75,
    blockOperation: false,
    escalateMode: 'DEGRADED', // NORMAL→DEGRADED only
    alertTargets: ['security_owner', 'ops_core'],
    sendSMS: false,
  },
  MEDIUM: {
    riskScore: 40,
    blockOperation: false,
    escalateMode: null,
    alertTargets: ['ops_core'],
    sendSMS: false,
  },
};

// Which invariant types produce which priority
export const INVARIANT_PRIORITIES: Record<string, InvariantPriority> = {
  'auth:silent_failure': 'CRITICAL',
  'auth:null_session': 'CRITICAL',
  'auth:timeout': 'HIGH',
  'payments:double_charge': 'CRITICAL',
  'payments:payment_lost': 'CRITICAL',
  'payments:webhook_replay': 'CRITICAL',
  'data:partial_write': 'HIGH',
  'data:earnings_decreased': 'HIGH',
  'data:fraud_flag_cleared': 'HIGH',
  'circuit:multi_open': 'HIGH',
  'circuit:single_open': 'MEDIUM',
  'resilience:single_degraded': 'MEDIUM',
  'resilience:total_failure': 'HIGH',
  'contract:violation': 'CRITICAL',
  'contract:near_miss': 'MEDIUM',
};
