// ═══════════════════════════════════════════════════════════════════════════
// Zero Trust — Dynamic Data Masking
//
// Masks sensitive data based on user role.
// Phone, email, amounts, locations, secrets, bank accounts.
// ═══════════════════════════════════════════════════════════════════════════

type MaskType = 'phone' | 'email' | 'amount' | 'location' | 'secret' | 'bank';

// Roles with full access to financial data
const FINANCIAL_ROLES = new Set(['exec_founder', 'super_admin']);
// Roles with full access to PII
const PII_ROLES = new Set(['support_manager', 'ops_core', 'exec_founder', 'security_owner', 'super_admin']);
// Roles with precise location access
const LOCATION_ROLES = new Set(['ops_core', 'exec_founder', 'super_admin']);

export function maskValue(value: string, type: MaskType, userRole: string): string {
  if (!value) return '—';

  switch (type) {
    case 'phone':
      if (PII_ROLES.has(userRole)) return value;
      // Show only last 4 digits
      return value.length >= 4
        ? `***-***-${value.slice(-4)}`
        : '***-***-****';

    case 'email':
      if (PII_ROLES.has(userRole)) return value;
      // Show first 2 chars + domain
      const [local, domain] = value.split('@');
      if (!domain) return '***@***.***';
      return `${local.slice(0, 2)}***@${domain}`;

    case 'amount':
      if (FINANCIAL_ROLES.has(userRole)) return value;
      return '•••.••';

    case 'location':
      if (LOCATION_ROLES.has(userRole)) return value;
      // City-level only: strip precise coords
      // If it looks like coords, mask them
      if (/^-?\d+\.\d+/.test(value)) {
        const parts = value.split(',');
        if (parts.length >= 2) {
          // Round to 1 decimal (~11km precision = city level)
          const lat = parseFloat(parts[0]).toFixed(1);
          const lng = parseFloat(parts[1]).toFixed(1);
          return `~${lat}, ~${lng} (approx)`;
        }
      }
      return value;

    case 'secret':
      // Never show secrets regardless of role
      return '••••••••••••';

    case 'bank':
      if (FINANCIAL_ROLES.has(userRole)) return value;
      // Last 4 digits only
      return value.length >= 4
        ? `••••${value.slice(-4)}`
        : '••••••••';

    default:
      return value;
  }
}

export function shouldMask(type: MaskType, userRole: string): boolean {
  switch (type) {
    case 'secret': return true; // Always masked
    case 'phone':
    case 'email':
      return !PII_ROLES.has(userRole);
    case 'amount':
    case 'bank':
      return !FINANCIAL_ROLES.has(userRole);
    case 'location':
      return !LOCATION_ROLES.has(userRole);
    default:
      return false;
  }
}
