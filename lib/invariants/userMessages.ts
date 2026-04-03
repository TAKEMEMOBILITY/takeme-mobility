// ═══════════════════════════════════════════════════════════════════════════
// User-facing messages for every invariant failure
// ═══════════════════════════════════════════════════════════════════════════

export interface UserMessage {
  title: string;
  description: string;
  showRetry: boolean;
  severity: 'info' | 'warning' | 'error';
}

const MESSAGES: Record<string, UserMessage> = {
  // Auth
  'auth:timeout': { title: 'Login is taking longer than usual', description: 'Please try again.', showRetry: true, severity: 'warning' },
  'auth:null_session': { title: "We couldn't verify your identity", description: 'Please try again.', showRetry: true, severity: 'error' },
  'auth:consecutive_failures': { title: 'Too many attempts', description: 'Please wait 30 minutes before trying again.', showRetry: false, severity: 'error' },
  'auth:service_down': { title: 'Authentication temporarily unavailable', description: "We're working on it. Please try again in a few minutes.", showRetry: true, severity: 'error' },

  // Payments
  'payment:already_processing': { title: 'Your payment is being processed', description: "Please don't retry. We'll confirm shortly.", showRetry: false, severity: 'info' },
  'payment:already_succeeded': { title: 'This ride has already been paid', description: 'No additional charge was made.', showRetry: false, severity: 'info' },
  'payment:double_charge_blocked': { title: 'A duplicate charge was detected and blocked', description: 'You were not charged twice.', showRetry: false, severity: 'info' },
  'payment:service_down': { title: 'Payment processing is delayed', description: "Your ride is confirmed. We'll process payment shortly.", showRetry: false, severity: 'warning' },

  // System degradation
  'system:single_degraded': { title: 'Some features may be slower than usual', description: '', showRetry: false, severity: 'info' },
  'system:multiple_degraded': { title: "We're experiencing technical difficulties", description: 'Core features remain available.', showRetry: false, severity: 'warning' },
  'system:defensive': { title: 'System operating in reduced capacity', description: 'Rides and payments are prioritized.', showRetry: false, severity: 'warning' },
  'system:lockdown': { title: 'TakeMe is temporarily unavailable', description: "We're performing maintenance. We'll be back shortly.", showRetry: false, severity: 'error' },
};

export function getUserMessage(key: string): UserMessage {
  return MESSAGES[key] ?? { title: 'Something went wrong', description: 'Please try again.', showRetry: true, severity: 'error' };
}
