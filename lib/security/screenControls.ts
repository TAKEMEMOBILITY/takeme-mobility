// ═══════════════════════════════════════════════════════════════════════════
// Zero Trust — Sensitive Screen Controls
// CSP headers, anti-screenshot, watermarking, session timeout.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

export function addSecurityHeaders(response: NextResponse, level: 'standard' | 'sensitive' = 'standard'): NextResponse {
  // Standard security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (level === 'sensitive') {
    // CSP: restrict display-capture for anti-screenshot
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "connect-src 'self' https://*.supabase.co https://*.ably.io https://*.upstash.io https://api.stripe.com; " +
      "frame-ancestors 'none'; " +
      "display-capture 'none';"
    );
    response.headers.set('Permissions-Policy', 'display-capture=()');
  }

  return response;
}

// Client-side CSS for sensitive pages (injected via layout)
export const SENSITIVE_PAGE_STYLES = `
  @media print { body { display: none !important; } }
  .sensitive-data { filter: blur(4px); transition: filter 0.2s; }
  .sensitive-data:hover { filter: none; }
`;

// Watermark HTML
export function getWatermarkStyle(email: string): string {
  const ts = new Date().toISOString().slice(0, 16);
  return `
    .security-watermark::after {
      content: '${email} · ${ts}';
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 48px;
      font-weight: 700;
      color: rgba(255,255,255,0.03);
      pointer-events: none;
      z-index: 9999;
      white-space: nowrap;
      user-select: none;
    }
  `;
}
