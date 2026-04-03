import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ═══════════════════════════════════════════════════════════════════════════
// Zero Trust Proxy — Server-Side Route Enforcement
// "Trust no one. Verify everything."
//
// UI hiding is NOT security. Every check happens on the server.
// /ops and /security return 404 to unauthorized users — never 403.
// ═══════════════════════════════════════════════════════════════════════════

// Route → allowed roles matrix
const ROUTE_ROLES: Record<string, string[]> = {
  '/admin': ['backoffice_staff', 'support_manager', 'ops_core', 'exec_founder', 'security_owner', 'super_admin'],
  '/exec': ['exec_founder', 'super_admin'],
  '/ops': ['ops_core', 'exec_founder', 'super_admin'],
  '/security': ['security_owner', 'super_admin'],
};

// Routes that return 404 (not 403) for unauthorized users
const STEALTH_ROUTES = new Set(['/ops', '/security']);

// Routes that require MFA-verified session
const MFA_ROUTES = new Set(['/security']);

// Session timeout per role (minutes)
const ROLE_TIMEOUTS: Record<string, number> = {
  exec_founder: 15,
  security_owner: 10,
  ops_core: 30,
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files and API routes (API routes have their own guards)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Find matching protected route
  const protectedPrefix = Object.keys(ROUTE_ROLES).find((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!protectedPrefix) {
    return NextResponse.next();
  }

  const allowedRoles = ROUTE_ROLES[protectedPrefix];
  const isStealth = STEALTH_ROUTES.has(protectedPrefix);

  // Create Supabase client for auth check
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Step 1: Check authentication
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (isStealth) {
      // Return genuine 404 — never reveal route exists
      return NextResponse.rewrite(new URL('/unauthorized', request.url));
    }
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Step 2: Get user role from DB (service client via fetch to avoid edge runtime issues)
  // We use the anon client with the user's session to query their own profile
  // But for role checks we need the service client — use a lightweight approach
  const roleRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/riders?id=eq.${user.id}&select=role,mfa_enabled,locked_until,session_timeout_minutes`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
    },
  );

  if (!roleRes.ok) {
    return isStealth
      ? NextResponse.rewrite(new URL('/unauthorized', request.url))
      : NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const profiles = await roleRes.json() as Array<{
    role: string;
    mfa_enabled: boolean;
    locked_until: string | null;
    session_timeout_minutes: number;
  }>;

  const profile = profiles[0];

  if (!profile) {
    return isStealth
      ? NextResponse.rewrite(new URL('/unauthorized', request.url))
      : NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Step 3: Check account lock
  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    return isStealth
      ? NextResponse.rewrite(new URL('/unauthorized', request.url))
      : NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Step 4: Check role authorization
  if (!allowedRoles.includes(profile.role)) {
    // Log unauthorized access attempt
    logAccessAttempt(user.id, user.email ?? '', profile.role, pathname, false, request);

    return isStealth
      ? NextResponse.rewrite(new URL('/unauthorized', request.url))
      : NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  // Step 5: IP allowlist check for stealth routes
  if (isStealth) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const ipRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ip_allowlist?select=ip_cidr&or=(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      },
    );

    if (ipRes.ok) {
      const allowlist = await ipRes.json() as Array<{ ip_cidr: string }>;
      if (allowlist.length > 0) {
        const ipAllowed = allowlist.some((entry) => {
          if (entry.ip_cidr === ip || entry.ip_cidr === `${ip}/32`) return true;
          // Simple /24 check
          const [cidrBase] = entry.ip_cidr.split('/');
          const cidrPrefix = cidrBase.split('.').slice(0, 3).join('.');
          const ipPrefix = ip.split('.').slice(0, 3).join('.');
          return entry.ip_cidr.endsWith('/24') && cidrPrefix === ipPrefix;
        });

        if (!ipAllowed) {
          logAccessAttempt(user.id, user.email ?? '', profile.role, pathname, false, request, 80);
          return NextResponse.rewrite(new URL('/unauthorized', request.url));
        }
      }
    }
  }

  // Step 6: MFA check for restricted routes
  if (MFA_ROUTES.has(protectedPrefix) && !profile.mfa_enabled) {
    logAccessAttempt(user.id, user.email ?? '', profile.role, pathname, false, request, 60);
    return NextResponse.rewrite(new URL('/unauthorized', request.url));
  }

  // Step 7: Log successful access
  logAccessAttempt(user.id, user.email ?? '', profile.role, pathname, true, request);

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  if (isStealth) {
    response.headers.set('Permissions-Policy', 'display-capture=()');
  }

  return response;
}

// Non-blocking audit log via fire-and-forget fetch
function logAccessAttempt(
  userId: string,
  email: string,
  role: string,
  path: string,
  success: boolean,
  request: NextRequest,
  riskScore: number = 0,
) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';

  // Fire and forget — non-blocking
  fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_logs`,
    {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        user_email: email,
        user_role: role,
        action: success ? 'page_access' : 'access_denied',
        resource: path,
        ip_address: ip,
        user_agent: ua,
        success,
        risk_score: riskScore || (success ? 0 : 30),
        metadata: { path, method: 'GET' },
      }),
    },
  ).catch(() => {});
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/exec/:path*',
    '/ops/:path*',
    '/security/:path*',
  ],
};
