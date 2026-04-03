import { createServiceClient } from '@/lib/supabase/service';
import type { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════
// Zero Trust — Immutable Audit Logger
// Every action, every access, every failure. No exceptions.
// ═══════════════════════════════════════════════════════════════════════════

interface AuditParams {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  request?: NextRequest | Request;
  success: boolean;
  metadata?: Record<string, unknown>;
  riskScore?: number;
  sessionId?: string;
}

function extractIP(request?: NextRequest | Request): string {
  if (!request) return 'unknown';
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

function extractDeviceFingerprint(request?: NextRequest | Request): string {
  if (!request) return 'unknown';
  const ua = request.headers.get('user-agent') ?? '';
  // Simple fingerprint from user agent + accept-language
  const lang = request.headers.get('accept-language') ?? '';
  return Buffer.from(`${ua}|${lang}`).toString('base64').slice(0, 40);
}

function calculateRiskScore(params: AuditParams): number {
  let score = params.riskScore ?? 0;

  // Sensitive resources
  const sensitive = ['security', 'audit_logs', 'ip_allowlist', 'role_permissions'];
  if (sensitive.includes(params.resource)) score += 15;

  // Failed actions
  if (!params.success) score += 20;

  // Bulk exports
  if (params.action === 'export') score += 25;

  // Outside business hours (UTC 22:00-06:00)
  const hour = new Date().getUTCHours();
  if (hour >= 22 || hour < 6) score += 10;

  // Delete actions
  if (params.action === 'delete') score += 15;

  return Math.min(score, 100);
}

export async function auditLog(params: AuditParams): Promise<void> {
  // Never throw — audit failure must not block the action
  try {
    const svc = createServiceClient();
    const ip = extractIP(params.request);
    const fingerprint = extractDeviceFingerprint(params.request);
    const ua = params.request?.headers.get('user-agent') ?? null;
    const risk = calculateRiskScore(params);

    await svc.from('audit_logs').insert({
      user_id: params.userId ?? null,
      user_email: params.userEmail ?? null,
      user_role: params.userRole ?? null,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId ?? null,
      ip_address: ip,
      device_fingerprint: fingerprint,
      user_agent: ua,
      session_id: params.sessionId ?? null,
      success: params.success,
      risk_score: risk,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error('[audit] CRITICAL: Failed to write audit log:', err);
  }
}
