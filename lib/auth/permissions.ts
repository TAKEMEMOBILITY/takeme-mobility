import { createServiceClient } from '@/lib/supabase/service';
import { auditLog } from '@/lib/auth/audit';

// ═══════════════════════════════════════════════════════════════════════════
// Zero Trust — Server-Side Permission Checks
// Never trust client-side role claims.
// ═══════════════════════════════════════════════════════════════════════════

// In-memory cache with 60s TTL
const cache = new Map<string, { result: boolean; expires: number }>();

export async function checkPermission(
  userId: string,
  resource: string,
  action: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const svc = createServiceClient();

  // Get user role from DB (never trust client claims)
  const { data: user } = await svc
    .from('riders')
    .select('role, locked_until, mfa_enabled')
    .eq('id', userId)
    .single();

  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  // Check account lock
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return { allowed: false, reason: 'Account locked' };
  }

  const role = user.role as string;

  // Super admin wildcard
  if (role === 'super_admin') {
    return { allowed: true };
  }

  // Check cache
  const cacheKey = `${role}:${resource}:${action}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return { allowed: cached.result };
  }

  // Query permissions table
  const { data: perms } = await svc
    .from('role_permissions')
    .select('allowed')
    .eq('role', role)
    .eq('resource', resource)
    .eq('action', action)
    .limit(1);

  const allowed = perms && perms.length > 0 ? perms[0].allowed : false;

  // Cache for 60 seconds
  cache.set(cacheKey, { result: allowed, expires: Date.now() + 60_000 });

  return {
    allowed,
    reason: allowed ? undefined : `Role '${role}' lacks ${action} on ${resource}`,
  };
}

export async function getUserRole(userId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('riders')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role ?? null;
}

export async function requireRole(
  userId: string,
  allowedRoles: string[],
  request?: Request,
): Promise<{ allowed: boolean; role: string | null; reason?: string }> {
  const role = await getUserRole(userId);
  if (!role) {
    await auditLog({
      userId,
      action: 'access',
      resource: 'role_check',
      success: false,
      request,
      metadata: { requiredRoles: allowedRoles, reason: 'no_role' },
    });
    return { allowed: false, role: null, reason: 'No role assigned' };
  }

  const allowed = allowedRoles.includes(role);
  if (!allowed) {
    await auditLog({
      userId,
      userRole: role,
      action: 'access_denied',
      resource: 'role_check',
      success: false,
      request,
      riskScore: 30,
      metadata: { requiredRoles: allowedRoles, actualRole: role },
    });
  }

  return { allowed, role, reason: allowed ? undefined : `Role '${role}' not in allowed list` };
}
