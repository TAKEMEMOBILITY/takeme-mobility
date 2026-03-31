'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TAKEME ADMIN DASHBOARD
// Real-time metrics, driver management, ride oversight, system health.
// Auto-refreshes every 10 seconds. Requires admin role.
// ═══════════════════════════════════════════════════════════════════════════

interface DashboardData {
  metrics: {
    activeRides: number;
    completedToday: number;
    completedWeek: number;
    completedMonth: number;
    totalDrivers: number;
    availableDrivers: number;
    onlineDrivers: number;
    totalRiders: number;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
  };
  dispatch: { queueLength: number; dlqLength: number; pendingApplications: number };
  activeRides: Array<{ id: string; status: string; pickup_address: string; dropoff_address: string; estimated_fare: number; assigned_driver_id: string | null; requested_at: string }>;
  recentRides: Array<{ id: string; status: string; pickup_address: string; dropoff_address: string; estimated_fare: number; final_fare: number | null; vehicle_class: string; requested_at: string; trip_completed_at: string | null }>;
  pendingApplications: Array<{ id: string; full_name: string; phone: string; email: string; status: string; created_at: string }>;
  recentApplications: Array<{ id: string; full_name: string; phone: string; email: string; vehicle_make: string; vehicle_model: string; status: string; created_at: string }>;
  timestamp: string;
}

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ago = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
};

const STATUS_COLORS: Record<string, string> = {
  searching_driver: '#F59E0B',
  driver_assigned: '#3B82F6',
  driver_arriving: '#8B5CF6',
  arrived: '#6366F1',
  in_progress: '#10B981',
  completed: '#059669',
  cancelled: '#EF4444',
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'rides' | 'dispatch' | 'system'>('overview');
  const [actionLoading, setActionLoading] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.status === 401 || res.status === 403) {
        setError('Admin access required. Please sign in with an admin account.');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError('');
    } catch (err) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  const performAction = async (action: string, targetId: string, reason?: string) => {
    setActionLoading(targetId);
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId, reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Action failed: ${data.error}`);
      } else {
        fetchData(); // Refresh
      }
    } catch {
      alert('Action failed');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <Page><Center>Loading dashboard...</Center></Page>;
  if (error) return <Page><Center style={{ color: '#EF4444' }}>{error}</Center></Page>;
  if (!data) return <Page><Center>No data</Center></Page>;

  const m = data.metrics;

  return (
    <Page>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', margin: 0 }}>TakeMe Admin</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }}>
            Last updated: {data.timestamp ? ago(data.timestamp) : '...'} · Auto-refreshes every 10s
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['overview', 'drivers', 'rides', 'dispatch', 'system'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                backgroundColor: activeTab === tab ? '#0F172A' : '#F1F5F9',
                color: activeTab === tab ? '#fff' : '#64748B',
              }}
            >{tab}</button>
          ))}
        </div>
      </div>

      {/* Metrics Cards — always visible */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <MetricCard label="Active Rides" value={m.activeRides} color="#3B82F6" />
        <MetricCard label="Online Drivers" value={m.onlineDrivers} sub={`${m.availableDrivers} available / ${m.totalDrivers} total`} color="#10B981" />
        <MetricCard label="Total Riders" value={m.totalRiders} color="#8B5CF6" />
        <MetricCard label="Revenue Today" value={usd(m.revenueToday)} sub={`Week: ${usd(m.revenueWeek)} · Month: ${usd(m.revenueMonth)}`} color="#F59E0B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <MetricCard label="Completed Today" value={m.completedToday} color="#059669" />
        <MetricCard label="Completed Week" value={m.completedWeek} color="#059669" />
        <MetricCard label="Completed Month" value={m.completedMonth} color="#059669" />
        <MetricCard label="Dispatch Queue" value={data.dispatch.queueLength} sub={`DLQ: ${data.dispatch.dlqLength}`} color={data.dispatch.dlqLength > 0 ? '#EF4444' : '#94A3B8'} />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Active Rides */}
          <Section title={`Active Rides (${data.activeRides.length})`}>
            {data.activeRides.length === 0 ? <Empty>No active rides</Empty> : (
              <Table headers={['Status', 'Pickup', 'Dropoff', 'Fare', 'Requested', 'Actions']}>
                {data.activeRides.map(r => (
                  <tr key={r.id}>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={td}>{r.pickup_address?.slice(0, 30)}</td>
                    <td style={td}>{r.dropoff_address?.slice(0, 30)}</td>
                    <td style={td}>{usd(Number(r.estimated_fare))}</td>
                    <td style={td}>{ago(r.requested_at)}</td>
                    <td style={td}>
                      <ActionBtn label="Cancel" color="#EF4444" loading={actionLoading === r.id}
                        onClick={() => performAction('cancel_ride', r.id, 'Admin cancelled')} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          {/* Recent Rides */}
          <Section title="Recent Rides">
            <Table headers={['Status', 'Pickup', 'Dropoff', 'Class', 'Fare', 'When']}>
              {data.recentRides.map(r => (
                <tr key={r.id}>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={td}>{r.pickup_address?.slice(0, 25)}</td>
                  <td style={td}>{r.dropoff_address?.slice(0, 25)}</td>
                  <td style={td}>{r.vehicle_class}</td>
                  <td style={td}>{usd(Number(r.final_fare ?? r.estimated_fare))}</td>
                  <td style={td}>{ago(r.requested_at)}</td>
                </tr>
              ))}
            </Table>
          </Section>
        </>
      )}

      {activeTab === 'drivers' && (
        <>
          {/* Pending Applications */}
          <Section title={`Pending Applications (${data.pendingApplications.length})`}>
            {data.pendingApplications.length === 0 ? <Empty>No pending applications</Empty> : (
              <Table headers={['Name', 'Phone', 'Email', 'Applied', 'Actions']}>
                {data.pendingApplications.map(app => (
                  <tr key={app.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{app.full_name}</td>
                    <td style={td}>{app.phone}</td>
                    <td style={td}>{app.email}</td>
                    <td style={td}>{ago(app.created_at)}</td>
                    <td style={{ ...td, display: 'flex', gap: 8 }}>
                      <ActionBtn label="Approve" color="#10B981" loading={actionLoading === app.id}
                        onClick={() => performAction('approve_driver', app.id)} />
                      <ActionBtn label="Reject" color="#EF4444" loading={actionLoading === app.id}
                        onClick={() => performAction('reject_driver', app.id, 'Does not meet requirements')} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          {/* All Applications */}
          <Section title="All Applications">
            <Table headers={['Name', 'Vehicle', 'Status', 'Applied']}>
              {data.recentApplications.map(app => (
                <tr key={app.id}>
                  <td style={{ ...td, fontWeight: 500 }}>{app.full_name}</td>
                  <td style={td}>{app.vehicle_make} {app.vehicle_model}</td>
                  <td><StatusBadge status={app.status} /></td>
                  <td style={td}>{ago(app.created_at)}</td>
                </tr>
              ))}
            </Table>
          </Section>
        </>
      )}

      {activeTab === 'rides' && (
        <Section title="Ride Management">
          <Table headers={['ID', 'Status', 'Route', 'Class', 'Fare', 'When', 'Actions']}>
            {data.recentRides.map(r => (
              <tr key={r.id}>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{r.id.slice(0, 8)}...</td>
                <td><StatusBadge status={r.status} /></td>
                <td style={td}>{r.pickup_address?.slice(0, 20)} → {r.dropoff_address?.slice(0, 20)}</td>
                <td style={td}>{r.vehicle_class}</td>
                <td style={td}>{usd(Number(r.final_fare ?? r.estimated_fare))}</td>
                <td style={td}>{ago(r.requested_at)}</td>
                <td style={{ ...td, display: 'flex', gap: 6 }}>
                  {r.status !== 'completed' && r.status !== 'cancelled' && (
                    <ActionBtn label="Cancel" color="#EF4444" loading={actionLoading === r.id}
                      onClick={() => performAction('cancel_ride', r.id)} />
                  )}
                  {r.status === 'completed' && (
                    <ActionBtn label="Refund" color="#F59E0B" loading={actionLoading === r.id}
                      onClick={() => performAction('refund_ride', r.id)} />
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {activeTab === 'dispatch' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <MetricCard label="Queue Depth" value={data.dispatch.queueLength} color="#3B82F6" />
            <MetricCard label="Dead Letter Queue" value={data.dispatch.dlqLength} color={data.dispatch.dlqLength > 0 ? '#EF4444' : '#10B981'} />
            <MetricCard label="Pending Apps" value={data.dispatch.pendingApplications} color="#F59E0B" />
          </div>
          <Section title="Dispatch System Status">
            <div style={{ padding: 24, backgroundColor: '#F8FAFC', borderRadius: 12, fontSize: 14, color: '#334155', lineHeight: 2 }}>
              <div><strong>QStash:</strong> {data.dispatch.queueLength === 0 ? 'Idle — no pending dispatches' : `${data.dispatch.queueLength} rides awaiting dispatch`}</div>
              <div><strong>Dead Letter Queue:</strong> {data.dispatch.dlqLength === 0 ? 'Clean — no failed dispatches' : `${data.dispatch.dlqLength} failed dispatches need review`}</div>
              <div><strong>Offer Timeout:</strong> 15 seconds per driver</div>
              <div><strong>Max Escalations:</strong> 3 drivers before cancellation</div>
              <div><strong>Safety Net:</strong> Vercel Cron every 60 seconds</div>
            </div>
          </Section>
        </>
      )}

      {activeTab === 'system' && (
        <>
          <Section title="System Health">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <HealthCard title="Redis (Upstash)" status="connected" detail={`Queue: ${data.dispatch.queueLength} · DLQ: ${data.dispatch.dlqLength}`} />
              <HealthCard title="Supabase" status="connected" detail={`${m.totalRiders} riders · ${m.totalDrivers} drivers`} />
              <HealthCard title="Stripe" status="connected" detail={`Revenue today: ${usd(m.revenueToday)}`} />
              <HealthCard title="QStash Dispatch" status={data.dispatch.dlqLength > 0 ? 'warning' : 'connected'} detail={data.dispatch.dlqLength > 0 ? `${data.dispatch.dlqLength} failed dispatches` : 'All dispatches healthy'} />
            </div>
          </Section>
          <Section title="Environment">
            <div style={{ padding: 24, backgroundColor: '#0F172A', borderRadius: 12, fontFamily: 'monospace', fontSize: 12, color: '#94A3B8', lineHeight: 2.2 }}>
              <div>NODE_ENV={process.env.NODE_ENV ?? 'production'}</div>
              <div>STRIPE_ISSUING={process.env.NEXT_PUBLIC_STRIPE_ISSUING_ENABLED ?? 'false'}</div>
              <div>SENTRY_DSN={process.env.NEXT_PUBLIC_SENTRY_DSN ? 'configured' : 'not set'}</div>
              <div>TIMESTAMP={data.timestamp}</div>
            </div>
          </Section>
        </>
      )}
    </Page>
  );
}

// ── UI Components ────────────────────────────────────────────────────────

const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' };

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAFBFC', padding: '32px 48px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

function Center({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', fontSize: 16, color: '#64748B', ...style }}>{children}</div>;
}

function MetricCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #F1F5F9' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color, margin: '8px 0 0', letterSpacing: -0.5 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#94A3B8', margin: '6px 0 0' }}>{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', marginBottom: 12 }}>{title}</h2>
      <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #F1F5F9', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#94A3B8' }}>{children}</div>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ backgroundColor: '#F8FAFC' }}>
          {headers.map(h => (
            <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#94A3B8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #F1F5F9' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#94A3B8';
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, color,
      backgroundColor: color + '15', whiteSpace: 'nowrap',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ActionBtn({ label, color, onClick, loading }: { label: string; color: string; onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '5px 12px', borderRadius: 6, border: `1px solid ${color}33`,
        backgroundColor: color + '10', color, fontSize: 12, fontWeight: 600,
        cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1,
      }}
    >{loading ? '...' : label}</button>
  );
}

function HealthCard({ title, status, detail }: { title: string; status: 'connected' | 'warning' | 'error'; detail: string }) {
  const colors = { connected: '#10B981', warning: '#F59E0B', error: '#EF4444' };
  const c = colors[status];
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, border: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{title}</span>
      </div>
      <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{detail}</p>
    </div>
  );
}
