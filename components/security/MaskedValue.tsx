'use client';

import { maskValue, shouldMask } from '@/lib/security/dataMasking';

// ═══════════════════════════════════════════════════════════════════════════
// MaskedValue — Displays data with role-based masking
//
// Applies correct masking rule based on userRole.
// On hover: tooltip explains permission level.
// Logs view attempts of masked data to audit_logs.
// ═══════════════════════════════════════════════════════════════════════════

interface MaskedValueProps {
  value: string;
  type: 'phone' | 'email' | 'amount' | 'location' | 'secret' | 'bank';
  userRole: string;
  className?: string;
}

export default function MaskedValue({ value, type, userRole, className = '' }: MaskedValueProps) {
  const isMasked = shouldMask(type, userRole);
  const displayed = maskValue(value, type, userRole);

  const handleHover = () => {
    if (isMasked) {
      // Log attempt to view masked data (fire-and-forget)
      fetch('/api/security/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'view_masked_data',
          type,
          masked: true,
        }),
      }).catch(() => {});
    }
  };

  return (
    <span
      className={`${className} ${isMasked ? 'cursor-not-allowed' : ''}`}
      title={isMasked ? "You don't have permission to view this" : undefined}
      onMouseEnter={handleHover}
    >
      {displayed}
    </span>
  );
}
