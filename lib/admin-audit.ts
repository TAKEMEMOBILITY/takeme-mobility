import { createServiceClient } from '@/lib/supabase/service';

export async function logAdminAction(params: {
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from('admin_audit_log').insert({
      admin_id: params.adminId,
      admin_email: params.adminEmail,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId ?? null,
      details: params.details ?? {},
      ip_address: params.ipAddress ?? null,
    });
  } catch (err) {
    console.error('[audit] Failed to log admin action:', err);
  }
}
