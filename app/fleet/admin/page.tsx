'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Car, Users, Calendar, DollarSign, BarChart3,
  Check, X, AlertTriangle, Loader2, ChevronDown,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface VehiclePhoto {
  id: string
  url: string
}

interface PendingVehicle {
  id: string
  make: string
  model: string
  year: number
  vin?: string
  owner_email?: string
  owner_id?: string
  daily_rate: number
  range_miles?: number
  connector_type?: string
  status: string
  vehicle_photos?: VehiclePhoto[]
  created_at: string
}

interface PendingOwner {
  id: string
  email: string
  business_type?: string
  status: string
  created_at: string
  fleet_owner_kyc?: Array<{ status: string }>
}

interface Booking {
  id: string
  vehicle_id: string
  driver_id: string
  start_date: string
  end_date: string
  total_rental_cents?: number
  total_amount?: number
  status: string
  created_at: string
  vehicle_name?: string
  driver_email?: string
}

interface Payout {
  id: string
  owner_id: string
  booking_id: string
  amount: number
  status: string
  hold_until?: string
  created_at: string
}

interface Metrics {
  totalActiveVehicles: number
  totalApprovedOwners: number
  bookingsByStatus: Record<string, number>
  totalRevenueCents: number
  totalCommissionsCents: number
  pendingPayouts: number
  pendingVehicleReviews: number
}

/* ------------------------------------------------------------------ */
/*  Animated counter                                                   */
/* ------------------------------------------------------------------ */
function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true) },
      { threshold: 0.3 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    let frame: number
    const duration = 1200
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setCount(Math.round(value * ease))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [started, value])

  return <span ref={ref}>{prefix}{count.toLocaleString()}</span>
}

/* ------------------------------------------------------------------ */
/*  Skeleton shimmer                                                   */
/* ------------------------------------------------------------------ */
function Skeleton({ width, height }: { width?: string; height?: string }) {
  return (
    <div
      style={{
        width: width ?? '100%',
        height: height ?? '20px',
        borderRadius: 8,
        background: 'linear-gradient(90deg, #f5f5f7 25%, #d2d2d7 50%, #f5f5f7 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: 'fleet-badge fleet-badge-green',
    in_use: 'fleet-badge fleet-badge-blue',
    completed: 'fleet-badge fleet-badge-gray',
    cancelled: 'fleet-badge fleet-badge-red',
    disputed: 'fleet-badge fleet-badge-red',
    pickup_ready: 'fleet-badge fleet-badge-blue',
    draft: 'fleet-badge fleet-badge-gray',
    pending_review: 'fleet-badge fleet-badge-yellow',
    pending_kyc: 'fleet-badge fleet-badge-yellow',
    pending: 'fleet-badge fleet-badge-yellow',
    active: 'fleet-badge fleet-badge-green',
    approved: 'fleet-badge fleet-badge-green',
    rejected: 'fleet-badge fleet-badge-red',
    suspended: 'fleet-badge fleet-badge-red',
    paid: 'fleet-badge fleet-badge-green',
    processing: 'fleet-badge fleet-badge-blue',
    held: 'fleet-badge fleet-badge-gray',
    failed: 'fleet-badge fleet-badge-red',
  }
  return (
    <span className={map[status] ?? 'fleet-badge fleet-badge-gray'}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: 'vehicles', label: 'Pending Vehicles', icon: Car },
  { key: 'owners', label: 'Pending Owners', icon: Users },
  { key: 'bookings', label: 'All Bookings', icon: Calendar },
  { key: 'payouts', label: 'Payout Queue', icon: DollarSign },
  { key: 'metrics', label: 'Metrics', icon: BarChart3 },
] as const

type TabKey = (typeof TABS)[number]['key']

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`
const shortId = (id: string) => id.slice(0, 8)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function FleetAdminPage() {
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading')
  const [activeTab, setActiveTab] = useState<TabKey>('vehicles')

  /* — Auth check — */
  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch('/api/auth/me')
        if (!meRes.ok) { setAuthState('denied'); return }
        const metricsRes = await fetch('/api/fleet/admin/metrics')
        if (metricsRes.status === 403) { setAuthState('denied'); return }
        if (!metricsRes.ok) { setAuthState('denied'); return }
        setAuthState('ok')
      } catch {
        setAuthState('denied')
      }
    })()
  }, [])

  /* — Auth loading — */
  if (authState === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Loader2 size={32} style={{ color: '#005bb5', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  /* — Access denied — */
  if (authState === 'denied') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          padding: 48,
          textAlign: 'center',
          maxWidth: 440,
          background: '#FFFFFF',
          border: '1px solid #d2d2d7',
          borderRadius: 12,
        }}>
          <Shield size={64} style={{ color: '#005bb5', margin: '0 auto 24px' }} />
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: '1.75rem',
            color: '#1d1d1f',
            marginBottom: 12,
          }}>
            Access Denied
          </h1>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            color: '#6e6e73',
            fontSize: '1rem',
            lineHeight: 1.6,
          }}>
            You need admin privileges to view this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        paddingTop: 96,
      }}
    >
      {/* Header */}
      <div style={{ padding: 'clamp(24px, 5vw, 80px)', paddingTop: 0, paddingBottom: 0 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Shield size={24} style={{ color: '#005bb5' }} />
            <h1 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              color: '#1d1d1f',
            }}>
              Fleet Admin
            </h1>
          </div>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            color: '#6e6e73',
            fontSize: '0.95rem',
          }}>
            Manage vehicles, owners, bookings, and payouts
          </p>
        </div>
      </div>

      {/* Tabs bar */}
      <div style={{
        marginTop: 32,
        background: '#FFFFFF',
        borderBottom: '1px solid #d2d2d7',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          padding: '0 clamp(24px, 5vw, 80px)',
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '16px 24px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #005bb5' : '2px solid transparent',
                  color: isActive ? '#005bb5' : '#6e6e73',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#1d1d1f' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#6e6e73' }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: 'clamp(24px, 5vw, 80px)', paddingTop: 32 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {activeTab === 'vehicles' && <PendingVehiclesTab />}
          {activeTab === 'owners' && <PendingOwnersTab />}
          {activeTab === 'bookings' && <AllBookingsTab />}
          {activeTab === 'payouts' && <PayoutQueueTab />}
          {activeTab === 'metrics' && <MetricsTab />}
        </div>
      </div>

      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  )
}

/* ================================================================== */
/*  Tab 1 — Pending Vehicles                                          */
/* ================================================================== */
function PendingVehiclesTab() {
  const [vehicles, setVehicles] = useState<PendingVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/fleet/admin/vehicles?status=pending_review')
      if (!res.ok) throw new Error('Failed to fetch vehicles')
      const data = await res.json()
      setVehicles(data.vehicles ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchVehicles() }, [fetchVehicles])

  const handleApprove = async (id: string) => {
    const prev = [...vehicles]
    setVehicles(vs => vs.filter(v => v.id !== id))
    setActionLoading(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch(`/api/fleet/admin/vehicles/${id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Approve failed')
    } catch (err) {
      console.error('[Admin] approve vehicle error:', err)
      setVehicles(prev)
    } finally {
      setActionLoading(s => ({ ...s, [id]: false }))
    }
  }

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return
    const prev = [...vehicles]
    setVehicles(vs => vs.filter(v => v.id !== id))
    setActionLoading(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch(`/api/fleet/admin/vehicles/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      if (!res.ok) throw new Error('Reject failed')
      setRejectingId(null)
      setRejectReason('')
    } catch (err) {
      console.error('[Admin] reject vehicle error:', err)
      setVehicles(prev)
    } finally {
      setActionLoading(s => ({ ...s, [id]: false }))
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ padding: 24, background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
            <Skeleton height="24px" width="60%" />
            <div style={{ marginTop: 12 }}><Skeleton height="16px" width="40%" /></div>
            <div style={{ marginTop: 8 }}><Skeleton height="16px" width="80%" /></div>
            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              <Skeleton height="40px" width="100px" />
              <Skeleton height="40px" width="100px" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: '#f0f5ff', border: '1px solid #bfdbfe', borderRadius: 12 }}>
        <AlertTriangle size={32} style={{ color: '#005bb5', margin: '0 auto 12px' }} />
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#005bb5' }}>{error}</p>
      </div>
    )
  }

  if (vehicles.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
        <Check size={48} style={{ color: '#86868b', margin: '0 auto 16px' }} />
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '1.25rem',
          color: '#1d1d1f',
          marginBottom: 8,
        }}>
          No vehicles pending review
        </p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.9rem' }}>
          All vehicle submissions have been processed.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AnimatePresence mode="popLayout">
        {vehicles.map(v => (
          <motion.div
            key={v.id}
            layout
            initial={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, x: -40 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ padding: 24, background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    fontSize: '1.25rem',
                    color: '#1d1d1f',
                    margin: 0,
                  }}>
                    {v.year} {v.make} {v.model}
                  </h3>
                  {v.vin && (
                    <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.8rem', marginTop: 4 }}>
                      VIN: {v.vin}
                    </p>
                  )}
                </div>
                <StatusBadge status={v.status} />
              </div>

              {/* Details */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                marginTop: 16,
              }}>
                {v.owner_email && (
                  <div>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Owner</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.875rem' }}>{v.owner_email}</span>
                  </div>
                )}
                <div>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Daily Rate</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.875rem' }}>${v.daily_rate}</span>
                </div>
                {v.range_miles != null && (
                  <div>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Range</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.875rem' }}>{v.range_miles} mi</span>
                  </div>
                )}
                {v.connector_type && (
                  <div>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Connector</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.875rem' }}>{v.connector_type}</span>
                  </div>
                )}
              </div>

              {/* Photos */}
              {v.vehicle_photos && v.vehicle_photos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16, overflowX: 'auto' }}>
                  {v.vehicle_photos.map(photo => (
                    <img
                      key={photo.id}
                      src={photo.url}
                      alt="Vehicle"
                      style={{
                        width: 80,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid #d2d2d7',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="fleet-btn-primary"
                  disabled={!!actionLoading[v.id]}
                  onClick={() => handleApprove(v.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#1D6AE5',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 100,
                    padding: '10px 20px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#004c99' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#1D6AE5' }}
                >
                  {actionLoading[v.id]
                    ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Check size={16} />}
                  Approve
                </button>

                {rejectingId === v.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 200 }}>
                    <input
                      type="text"
                      placeholder="Rejection reason..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="fleet-input"
                      style={{
                        flex: 1,
                        padding: '8px 14px',
                        background: '#FFFFFF',
                        border: '1px solid #d2d2d7',
                        borderRadius: 8,
                        color: '#1d1d1f',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') handleReject(v.id) }}
                    />
                    <button
                      disabled={!!actionLoading[v.id] || !rejectReason.trim()}
                      onClick={() => handleReject(v.id)}
                      style={{
                        background: '#f0f5ff',
                        color: '#005bb5',
                        border: '1px solid #bfdbfe',
                        borderRadius: 100,
                        padding: '8px 16px',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: rejectReason.trim() ? 1 : 0.5,
                      }}
                    >
                      {actionLoading[v.id]
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : null}
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason('') }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#86868b',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setRejectingId(v.id); setRejectReason('') }}
                    style={{
                      background: '#f0f5ff',
                      color: '#005bb5',
                      border: '1px solid #bfdbfe',
                      borderRadius: 100,
                      padding: '10px 20px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <X size={16} />
                    Reject
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ================================================================== */
/*  Tab 2 — Pending Owners                                            */
/* ================================================================== */
function PendingOwnersTab() {
  const [owners, setOwners] = useState<PendingOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const fetchOwners = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/fleet/admin/owners?status=pending_kyc')
      if (!res.ok) throw new Error('Failed to fetch owners')
      const data = await res.json()
      setOwners(data.owners ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOwners() }, [fetchOwners])

  const handleApprove = async (id: string) => {
    const prev = [...owners]
    setOwners(os => os.filter(o => o.id !== id))
    setActionLoading(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch(`/api/fleet/admin/owners/${id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Approve failed')
    } catch (err) {
      console.error('[Admin] approve owner error:', err)
      setOwners(prev)
    } finally {
      setActionLoading(s => ({ ...s, [id]: false }))
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ padding: 24, background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
            <Skeleton height="20px" width="50%" />
            <div style={{ marginTop: 10 }}><Skeleton height="14px" width="30%" /></div>
            <div style={{ marginTop: 16 }}><Skeleton height="36px" width="100px" /></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: '#f0f5ff', border: '1px solid #bfdbfe', borderRadius: 12 }}>
        <AlertTriangle size={32} style={{ color: '#005bb5', margin: '0 auto 12px' }} />
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#005bb5' }}>{error}</p>
      </div>
    )
  }

  if (owners.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
        <Check size={48} style={{ color: '#86868b', margin: '0 auto 16px' }} />
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '1.25rem',
          color: '#1d1d1f',
          marginBottom: 8,
        }}>
          No owners pending approval
        </p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.9rem' }}>
          All owner applications have been processed.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AnimatePresence mode="popLayout">
        {owners.map(o => {
          const kycStatus = o.fleet_owner_kyc?.[0]?.status ?? o.status
          return (
            <motion.div
              key={o.id}
              layout
              initial={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ padding: 24, background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{
                      fontFamily: "'DM Serif Display', Georgia, serif",
                      fontSize: '1.1rem',
                      color: '#1d1d1f',
                      margin: 0,
                    }}>
                      {o.email}
                    </h3>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                      {o.business_type && (
                        <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.85rem' }}>
                          {o.business_type}
                        </span>
                      )}
                      <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.85rem' }}>
                        Registered {fmtDate(o.created_at)}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={kycStatus} />
                </div>

                <div style={{ marginTop: 16 }}>
                  <button
                    className="fleet-btn-primary"
                    disabled={!!actionLoading[o.id]}
                    onClick={() => handleApprove(o.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#1D6AE5',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 100,
                      padding: '10px 20px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#004c99' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#1D6AE5' }}
                  >
                    {actionLoading[o.id]
                      ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Check size={16} />}
                    Approve
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

/* ================================================================== */
/*  Tab 3 — All Bookings                                              */
/* ================================================================== */
function AllBookingsTab() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(20)

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const url = statusFilter === 'all'
        ? '/api/fleet/admin/bookings?limit=50'
        : `/api/fleet/admin/bookings?limit=50&status=${statusFilter}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch bookings')
      const data = await res.json()
      setBookings(data.bookings ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  const statuses = ['all', 'confirmed', 'in_use', 'completed', 'cancelled', 'disputed']

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}><Skeleton height="40px" width="200px" /></div>
        <div style={{ padding: 24, background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ padding: '12px 0', borderBottom: i < 5 ? '1px solid #f5f5f7' : 'none' }}>
              <Skeleton height="18px" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: '#f0f5ff', border: '1px solid #bfdbfe', borderRadius: 12 }}>
        <AlertTriangle size={32} style={{ color: '#005bb5', margin: '0 auto 12px' }} />
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#005bb5' }}>{error}</p>
      </div>
    )
  }

  const displayed = bookings.slice(0, visibleCount)

  return (
    <div>
      {/* Filter bar */}
      <div style={{ marginBottom: 20, position: 'relative', display: 'inline-block' }}>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setVisibleCount(20) }}
          style={{
            appearance: 'none',
            background: '#FFFFFF',
            border: '1px solid #d2d2d7',
            borderRadius: 8,
            color: '#1d1d1f',
            padding: '10px 40px 10px 16px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.875rem',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {statuses.map(s => (
            <option key={s} value={s} style={{ background: '#FFFFFF' }}>
              {s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </option>
          ))}
        </select>
        <ChevronDown size={16} style={{
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#86868b',
          pointerEvents: 'none',
        }} />
      </div>

      {bookings.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
          <Calendar size={40} style={{ color: '#86868b', margin: '0 auto 12px' }} />
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73' }}>No bookings found</p>
        </div>
      ) : (
        <>
          <div style={{ padding: 0, overflowX: 'auto', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 1fr 1fr 100px 120px',
              padding: '14px 20px',
              borderBottom: '1px solid #d2d2d7',
              background: '#f5f5f7',
              borderRadius: '12px 12px 0 0',
              minWidth: 700,
            }}>
              {['ID', 'Vehicle', 'Driver', 'Dates', 'Amount', 'Status'].map(col => (
                <span key={col} style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.75rem',
                  color: '#6e6e73',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {col}
                </span>
              ))}
            </div>

            {/* Rows */}
            {displayed.map((b, idx) => {
              const amount = b.total_rental_cents != null ? usd(b.total_rental_cents) : b.total_amount != null ? `$${b.total_amount}` : '--'
              const isExpanded = expandedId === b.id
              return (
                <React.Fragment key={b.id}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : b.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 1fr 1fr 100px 120px',
                      padding: '14px 20px',
                      borderBottom: '1px solid #d2d2d7',
                      background: idx % 2 === 0 ? '#FFFFFF' : '#f5f5f7',
                      cursor: 'pointer',
                      minWidth: 700,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f7' }}
                    onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#f5f5f7' }}
                  >
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#86868b', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                      {shortId(b.id)}
                    </span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.85rem' }}>
                      {b.vehicle_name ?? shortId(b.vehicle_id)}
                    </span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.85rem' }}>
                      {b.driver_email ?? shortId(b.driver_id)}
                    </span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.85rem' }}>
                      {fmtDate(b.start_date)} - {fmtDate(b.end_date)}
                    </span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.85rem' }}>
                      {amount}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: 'hidden', borderBottom: '1px solid #d2d2d7' }}
                      >
                        <div style={{
                          padding: '16px 20px',
                          background: '#f5f5f7',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: 16,
                        }}>
                          <div>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Booking ID</span>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.85rem' }}>{b.id}</span>
                          </div>
                          <div>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Vehicle ID</span>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.85rem' }}>{b.vehicle_id}</span>
                          </div>
                          <div>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Driver ID</span>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.85rem' }}>{b.driver_id}</span>
                          </div>
                          <div>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Created</span>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f', fontSize: '0.85rem' }}>{fmtDate(b.created_at)}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              )
            })}
          </div>

          {/* Load more */}
          {bookings.length > visibleCount && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={() => setVisibleCount(c => c + 20)}
                className="fleet-btn-ghost"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #d2d2d7',
                  borderRadius: 100,
                  color: '#1d1d1f',
                  padding: '10px 24px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f7' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
              >
                Load more ({bookings.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ================================================================== */
/*  Tab 4 — Payout Queue                                              */
/* ================================================================== */
function PayoutQueueTab() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/fleet/admin/payouts?status=pending')
      if (!res.ok) throw new Error('Failed to fetch payouts')
      const data = await res.json()
      setPayouts(data.payouts ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPayouts() }, [fetchPayouts])

  const handleRelease = async (id: string) => {
    const prev = [...payouts]
    setPayouts(ps => ps.map(p => p.id === id ? { ...p, status: 'processing' } : p))
    setActionLoading(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch(`/api/fleet/admin/payouts/${id}/release`, { method: 'POST' })
      if (!res.ok) throw new Error('Release failed')
    } catch (err) {
      console.error('[Admin] release payout error:', err)
      setPayouts(prev)
    } finally {
      setActionLoading(s => ({ ...s, [id]: false }))
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ padding: 24, background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
            <Skeleton height="20px" width="60%" />
            <div style={{ marginTop: 10 }}><Skeleton height="14px" width="40%" /></div>
            <div style={{ marginTop: 16 }}><Skeleton height="36px" width="140px" /></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: '#f0f5ff', border: '1px solid #bfdbfe', borderRadius: 12 }}>
        <AlertTriangle size={32} style={{ color: '#005bb5', margin: '0 auto 12px' }} />
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#005bb5' }}>{error}</p>
      </div>
    )
  }

  if (payouts.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
        <Check size={48} style={{ color: '#86868b', margin: '0 auto 16px' }} />
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '1.25rem',
          color: '#1d1d1f',
          marginBottom: 8,
        }}>
          No pending payouts
        </p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.9rem' }}>
          All payouts have been processed.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {payouts.map(p => (
        <div key={p.id} style={{ padding: 24, background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: '1.5rem',
                  color: '#005bb5',
                }}>
                  ${(p.amount / 100).toFixed(2)}
                </span>
                <StatusBadge status={p.status} />
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginTop: 12,
              }}>
                <div>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Owner ID</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#86868b', fontSize: '0.85rem' }}>{shortId(p.owner_id)}</span>
                </div>
                <div>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Booking ID</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#86868b', fontSize: '0.85rem' }}>{shortId(p.booking_id)}</span>
                </div>
                {p.hold_until && (
                  <div>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.75rem', display: 'block' }}>Hold Until</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", color: '#86868b', fontSize: '0.85rem' }}>{fmtDate(p.hold_until)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              className="fleet-btn-primary"
              disabled={!!actionLoading[p.id] || p.status === 'processing'}
              onClick={() => handleRelease(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: p.status === 'processing' ? 0.5 : 1,
                background: '#1D6AE5',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 100,
                padding: '10px 20px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: p.status === 'processing' ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (p.status !== 'processing') e.currentTarget.style.background = '#004c99' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1D6AE5' }}
            >
              {actionLoading[p.id]
                ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                : <DollarSign size={16} />}
              {p.status === 'processing' ? 'Processing...' : 'Release Payout'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ================================================================== */
/*  Tab 5 — Metrics                                                   */
/* ================================================================== */
function MetricsTab() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/fleet/admin/metrics')
      if (!res.ok) throw new Error('Failed to fetch metrics')
      const data = await res.json()
      setMetrics(data.metrics ?? null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  if (loading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} style={{ padding: 24, background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
            <Skeleton height="14px" width="50%" />
            <div style={{ marginTop: 12 }}><Skeleton height="40px" width="60%" /></div>
          </div>
        ))}
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: '#f0f5ff', border: '1px solid #bfdbfe', borderRadius: 12 }}>
        <AlertTriangle size={32} style={{ color: '#005bb5', margin: '0 auto 12px' }} />
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#005bb5' }}>{error ?? 'Failed to load metrics'}</p>
      </div>
    )
  }

  const totalBookings = Object.values(metrics.bookingsByStatus).reduce((a, b) => a + b, 0)

  const cards: Array<{
    label: string
    value: number
    prefix?: string
    color: string
    icon: React.ElementType
  }> = [
    { label: 'Active Vehicles', value: metrics.totalActiveVehicles, color: '#1d1d1f', icon: Car },
    { label: 'Approved Owners', value: metrics.totalApprovedOwners, color: '#1d1d1f', icon: Users },
    { label: 'Total Bookings', value: totalBookings, color: '#1d1d1f', icon: Calendar },
    { label: 'Total Revenue', value: Math.round(metrics.totalRevenueCents / 100), prefix: '$', color: '#005bb5', icon: DollarSign },
    { label: 'Total Commissions', value: Math.round(metrics.totalCommissionsCents / 100), prefix: '$', color: '#005bb5', icon: BarChart3 },
    { label: 'Pending Reviews', value: metrics.pendingVehicleReviews, color: '#1d1d1f', icon: Car },
    { label: 'Pending Payouts', value: metrics.pendingPayouts, color: '#1d1d1f', icon: DollarSign },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 16,
    }}>
      {cards.map(card => {
        const Icon = card.icon
        return (
          <div key={card.label} style={{ padding: 24, position: 'relative', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12 }}>
            {/* Background icon */}
            <Icon
              size={64}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                color: '#f5f5f7',
                opacity: 0.08,
              }}
            />
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.8rem',
              color: '#6e6e73',
              display: 'block',
              marginBottom: 8,
            }}>
              {card.label}
            </span>
            <span style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '2.5rem',
              color: card.color,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>
              <AnimatedNumber value={card.value} prefix={card.prefix} />
            </span>
          </div>
        )
      })}
    </div>
  )
}
