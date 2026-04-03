-- ═══════════════════════════════════════════════════════════════════════════
-- 021 — Monitoring tables for Mission Control
-- ═══════════════════════════════════════════════════════════════════════════

-- Health check logs (every minute, all services)
create table if not exists monitoring_logs (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null check (status in ('ok', 'warn', 'error')),
  latency_ms int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

-- Alert history (deduplicated, tracks resolution)
create table if not exists monitoring_alerts (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  error text,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  sent_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Auto-fix audit trail
create table if not exists monitoring_fixes (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  fix_applied text not null,
  success bool not null default false,
  created_at timestamptz not null default now()
);

-- End-to-end synthetic transaction logs
create table if not exists monitoring_e2e (
  id uuid primary key default gen_random_uuid(),
  step text not null,
  status text not null check (status in ('pass', 'fail', 'skip')),
  duration_ms int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

-- Indexes for dashboard queries
create index if not exists idx_monitoring_logs_created on monitoring_logs (created_at desc);
create index if not exists idx_monitoring_logs_service on monitoring_logs (service, created_at desc);
create index if not exists idx_monitoring_alerts_sent on monitoring_alerts (sent_at desc);
create index if not exists idx_monitoring_alerts_service on monitoring_alerts (service, sent_at desc);
create index if not exists idx_monitoring_e2e_created on monitoring_e2e (created_at desc);

-- RLS: allow service role full access, block anon
alter table monitoring_logs enable row level security;
alter table monitoring_alerts enable row level security;
alter table monitoring_fixes enable row level security;
alter table monitoring_e2e enable row level security;

-- Service role policies (bypass RLS anyway, but explicit for clarity)
create policy "service_role_monitoring_logs" on monitoring_logs for all using (true) with check (true);
create policy "service_role_monitoring_alerts" on monitoring_alerts for all using (true) with check (true);
create policy "service_role_monitoring_fixes" on monitoring_fixes for all using (true) with check (true);
create policy "service_role_monitoring_e2e" on monitoring_e2e for all using (true) with check (true);

-- Auto-cleanup: delete logs older than 7 days (run via pg_cron or app-level)
-- This is a helper function the app can call periodically
create or replace function cleanup_monitoring_logs(retention_days int default 7)
returns int
language plpgsql
security definer
as $$
declare
  deleted int;
begin
  delete from monitoring_logs where created_at < now() - (retention_days || ' days')::interval;
  get diagnostics deleted = row_count;
  delete from monitoring_e2e where created_at < now() - (retention_days || ' days')::interval;
  return deleted;
end;
$$;
