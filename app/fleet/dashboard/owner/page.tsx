'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  LayoutDashboard, Car, Calendar, DollarSign, Zap, Clock,
  Check, X, ChevronRight, Plus, Filter
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Owner {
  id: string
  email: string
  name?: string
  user_id: string
}

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  daily_rate: number
  status: string
  photos?: string[]
  image_url?: string
}

interface Booking {
  id: string
  vehicle_id: string
  vehicle?: { make: string; model: string; year: number }
  driver_id: string
  start_date: string
  end_date: string
  total_amount: number
  status: string
  created_at: string
}

interface Payout {
  id: string
  booking_id: string
  amount: number
  status: string
  created_at: string
}

/* ------------------------------------------------------------------ */
/*  Animated Counter                                                   */
/* ------------------------------------------------------------------ */
function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true) },
      { threshold: 0.3 }
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
    pickup_ready: 'fleet-badge fleet-badge-blue',
    draft: 'fleet-badge fleet-badge-gray',
    pending_review: 'fleet-badge fleet-badge-yellow',
    active: 'fleet-badge fleet-badge-green',
    rejected: 'fleet-badge fleet-badge-red',
    suspended: 'fleet-badge fleet-badge-red',
    pending: 'fleet-badge fleet-badge-yellow',
    paid: 'fleet-badge fleet-badge-green',
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
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */
const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'vehicles', label: 'Vehicles', icon: Car },
  { key: 'bookings', label: 'Bookings', icon: Calendar },
  { key: 'payouts', label: 'Payouts', icon: DollarSign },
] as const

type TabKey = (typeof NAV_ITEMS)[number]['key']

/* ------------------------------------------------------------------ */
/*  Mini bar chart (CSS-only)                                          */
/* ------------------------------------------------------------------ */
function MiniBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const months = ['6mo', '5mo', '4mo', '3mo', '2mo', 'Now']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginTop: 16 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(v / max) * 60}px` }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            style={{
              width: '100%',
              maxWidth: 32,
              borderRadius: 4,
              background: '#005bb5',
            }}
          />
          <span style={{ fontSize: 10, color: '#86868b' }}>{months[i]}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function OwnerDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [owner, setOwner] = useState<Owner | null>(null)
  const [authError, setAuthError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [bookingFilter, setBookingFilter] = useState('all')

  /* Auth + data fetch */
  useEffect(() => {
    fetch('/api/fleet/owners/me')
      .then(r => r.json())
      .then(data => {
        if (!data.success) { setAuthError(true); setLoading(false); return }
        setOwner(data.data)
        return Promise.all([
          fetch('/api/fleet/vehicles').then(r => r.json()).catch(() => null),
          fetch('/api/fleet/bookings').then(r => r.json()).catch(() => null),
          fetch('/api/fleet/payouts').then(r => r.json()).catch(() => null),
        ])
      })
      .then(results => {
        if (!results) return
        const [vData, bData, pData] = results
        if (vData?.success && Array.isArray(vData.data)) setVehicles(vData.data)
        else if (Array.isArray(vData)) setVehicles(vData)
        if (bData?.success && Array.isArray(bData.data?.bookings)) setBookings(bData.data.bookings)
        else if (bData?.success && Array.isArray(bData.data)) setBookings(bData.data)
        else if (Array.isArray(bData)) setBookings(bData)
        if (pData?.success && Array.isArray(pData.data)) setPayouts(pData.data)
        else if (Array.isArray(pData)) setPayouts(pData)
        setLoading(false)
      })
      .catch(() => { setAuthError(true); setLoading(false) })
  }, [])

  /* Derived data */
  const totalEarned = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const now = new Date()
  const thisMonthEarned = payouts
    .filter(p => p.status === 'paid' && new Date(p.created_at).getMonth() === now.getMonth() && new Date(p.created_at).getFullYear() === now.getFullYear())
    .reduce((s, p) => s + p.amount, 0)
  const activeBookings = bookings.filter(b => ['confirmed', 'in_use', 'pickup_ready'].includes(b.status)).length
  const totalVehicles = vehicles.length

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  /* Last 6 months earnings for chart */
  const monthlyEarnings = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return payouts
      .filter(p => p.status === 'paid' && new Date(p.created_at).getMonth() === d.getMonth() && new Date(p.created_at).getFullYear() === d.getFullYear())
      .reduce((s, p) => s + p.amount, 0)
  })

  const filteredBookings = bookingFilter === 'all'
    ? bookings
    : bookings.filter(b => b.status === bookingFilter)

  /* ---- Auth error ---- */
  if (authError) {
    return (
      <div style={{
        minHeight: '80vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        fontFamily: "'DM Sans', sans-serif", color: '#6e6e73',
        background: '#FFFFFF',
      }}>
        <Zap size={40} color="#005bb5" />
        <p style={{ fontSize: '1.125rem', color: '#1d1d1f' }}>Sign in to access your dashboard</p>
        <Link href="/auth/login" className="fleet-btn-primary" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 28px', borderRadius: 10, textDecoration: 'none',
          fontWeight: 600,
        }}>
          Sign In <ChevronRight size={16} />
        </Link>
      </div>
    )
  }

  /* ---- Tab content renderers ---- */
  const renderOverview = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Welcome */}
      <h1 style={{
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', color: '#1d1d1f',
        margin: '0 0 24px',
      }}>
        {greeting}, {owner?.name ?? owner?.email ?? 'Owner'}
      </h1>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16, marginBottom: 32,
      }}>
        {[
          { label: 'Total Earned', value: totalEarned, prefix: '$', isMoney: true },
          { label: 'This Month', value: thisMonthEarned, prefix: '$', isMoney: true },
          { label: 'Active Bookings', value: activeBookings, isMoney: false },
          { label: 'Total Vehicles', value: totalVehicles, isMoney: false },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              padding: 24,
              background: '#FFFFFF',
              border: '1px solid #d2d2d7',
              borderRadius: 12,
            }}
          >
            <div style={{ color: '#6e6e73', fontSize: '0.875rem', marginBottom: 8 }}>{stat.label}</div>
            <div style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '2rem', color: stat.isMoney ? '#005bb5' : '#1d1d1f',
            }}>
              {loading ? <Skeleton width="80px" height="32px" /> : <AnimatedNumber value={stat.value} prefix={stat.prefix} />}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Bookings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        style={{
          padding: 24, marginBottom: 32, overflowX: 'auto',
          background: '#FFFFFF',
          border: '1px solid #d2d2d7',
          borderRadius: 12,
        }}
      >
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '1.25rem', color: '#1d1d1f', margin: '0 0 16px',
        }}>Recent Bookings</h2>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height="40px" />)}
          </div>
        ) : bookings.length === 0 ? (
          <p style={{ color: '#6e6e73' }}>No bookings yet</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f7', borderBottom: '1px solid #d2d2d7' }}>
                {['Vehicle', 'Driver', 'Dates', 'Amount', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6e6e73', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.slice(0, 5).map((b, idx) => (
                <tr key={b.id} style={{
                  borderBottom: '1px solid #d2d2d7',
                  background: idx % 2 === 0 ? '#FFFFFF' : '#f5f5f7',
                }}>
                  <td style={{ padding: '10px 12px', color: '#1d1d1f' }}>
                    {b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : b.vehicle_id.slice(0, 8)}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6e6e73' }}>{b.driver_id.slice(0, 8)}</td>
                  <td style={{ padding: '10px 12px', color: '#6e6e73' }}>
                    {new Date(b.start_date).toLocaleDateString()} – {new Date(b.end_date).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#1d1d1f' }}>${b.total_amount}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Payout Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        style={{
          padding: 24,
          background: '#FFFFFF',
          border: '1px solid #d2d2d7',
          borderRadius: 12,
        }}
      >
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '1.25rem', color: '#1d1d1f', margin: '0 0 4px',
        }}>Payout Summary</h2>
        <p style={{ color: '#6e6e73', margin: '0 0 8px', fontSize: '0.875rem' }}>
          Earnings this month: <span style={{ color: '#005bb5', fontWeight: 600 }}>${thisMonthEarned.toLocaleString()}</span>
        </p>
        <MiniBarChart data={monthlyEarnings} />
      </motion.div>
    </motion.div>
  )

  const renderVehicles = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '1.25rem', color: '#1d1d1f', margin: 0,
        }}>Your Vehicles</h2>
        <Link href="/fleet/list-your-ev" className="fleet-btn-primary" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 10, textDecoration: 'none',
          fontWeight: 600, fontSize: '0.875rem',
        }}>
          <Plus size={16} /> Add Vehicle
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              padding: 20, background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12,
            }}>
              <Skeleton height="80px" />
              <div style={{ marginTop: 12 }}><Skeleton width="60%" height="18px" /></div>
              <div style={{ marginTop: 8 }}><Skeleton width="40%" height="14px" /></div>
            </div>
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            padding: 48, textAlign: 'center',
            background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12,
          }}
        >
          <Car size={40} color="#86868b" style={{ marginBottom: 12 }} />
          <p style={{ color: '#6e6e73', fontSize: '1rem', margin: '0 0 16px' }}>No vehicles yet</p>
          <Link href="/fleet/list-your-ev" className="fleet-btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontWeight: 600,
          }}>
            <Plus size={16} /> List Your First EV
          </Link>
        </motion.div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {vehicles.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              style={{
                padding: 20, display: 'flex', gap: 16, alignItems: 'center',
                background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12,
              }}
            >
              <div style={{
                width: 80, height: 80, borderRadius: 10, overflow: 'hidden',
                background: '#f5f5f7', flexShrink: 0,
              }}>
                {(v.photos?.[0] ?? v.image_url) ? (
                  <img
                    src={v.photos?.[0] ?? v.image_url}
                    alt={`${v.make} ${v.model}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Car size={28} color="#86868b" />
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#1d1d1f', fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>
                  {v.year} {v.make} {v.model}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <StatusBadge status={v.status} />
                  <span style={{ color: '#6e6e73', fontSize: '0.875rem' }}>${v.daily_rate}/day</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )

  const renderBookings = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '1.25rem', color: '#1d1d1f', margin: 0,
        }}>Bookings</h2>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color="#86868b" />
          <select
            value={bookingFilter}
            onChange={e => setBookingFilter(e.target.value)}
            style={{
              background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 8,
              color: '#1d1d1f', padding: '8px 12px', fontSize: '0.875rem',
              appearance: 'auto', cursor: 'pointer',
            }}
          >
            <option value="all">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_use">In Use</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <motion.div style={{
        padding: 24, overflowX: 'auto',
        background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12,
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height="40px" />)}
          </div>
        ) : filteredBookings.length === 0 ? (
          <p style={{ color: '#6e6e73', textAlign: 'center', padding: 24 }}>No bookings found</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f7', borderBottom: '1px solid #d2d2d7' }}>
                {['Vehicle', 'Driver ID', 'Start Date', 'End Date', 'Amount', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6e6e73', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filteredBookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((b, idx) => (
                <tr key={b.id} style={{
                  borderBottom: '1px solid #d2d2d7',
                  background: idx % 2 === 0 ? '#FFFFFF' : '#f5f5f7',
                }}>
                  <td style={{ padding: '10px 12px', color: '#1d1d1f' }}>
                    {b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : b.vehicle_id.slice(0, 8)}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6e6e73' }}>{b.driver_id.slice(0, 8)}</td>
                  <td style={{ padding: '10px 12px', color: '#6e6e73' }}>{new Date(b.start_date).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 12px', color: '#6e6e73' }}>{new Date(b.end_date).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 12px', color: '#1d1d1f' }}>${b.total_amount}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </motion.div>
  )

  const renderPayouts = () => {
    const totalPending = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
    const totalPaid = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
    const nextPayout = payouts.find(p => p.status === 'pending')

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '1.25rem', color: '#1d1d1f', margin: '0 0 24px',
        }}>Payouts</h2>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Pending', value: totalPending, badge: 'fleet-badge fleet-badge-yellow' },
            { label: 'Total Paid', value: totalPaid, badge: 'fleet-badge fleet-badge-green' },
            { label: 'Next Payout', value: nextPayout?.amount ?? 0, badge: 'fleet-badge fleet-badge-gray' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              style={{
                padding: 24,
                background: '#FFFFFF',
                border: '1px solid #d2d2d7',
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: '#6e6e73', fontSize: '0.875rem' }}>{item.label}</span>
                <span className={item.badge}>{item.label.split(' ')[1]?.toLowerCase()}</span>
              </div>
              <div style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: '1.75rem', color: '#005bb5',
              }}>
                ${item.value.toLocaleString()}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Payout table */}
        <motion.div style={{
          padding: 24, overflowX: 'auto',
          background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12,
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => <Skeleton key={i} height="40px" />)}
            </div>
          ) : payouts.length === 0 ? (
            <p style={{ color: '#6e6e73', textAlign: 'center', padding: 24 }}>No payouts yet</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f5f5f7', borderBottom: '1px solid #d2d2d7' }}>
                  {['Booking', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6e6e73', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.map((p, idx) => (
                  <tr key={p.id} style={{
                    borderBottom: '1px solid #d2d2d7',
                    background: idx % 2 === 0 ? '#FFFFFF' : '#f5f5f7',
                  }}>
                    <td style={{ padding: '10px 12px', color: '#6e6e73' }}>{p.booking_id.slice(0, 8)}</td>
                    <td style={{ padding: '10px 12px', color: '#1d1d1f' }}>${p.amount}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '10px 12px', color: '#6e6e73' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </motion.div>
    )
  }

  const CONTENT: Record<TabKey, () => React.ReactNode> = {
    overview: renderOverview,
    vehicles: renderVehicles,
    bookings: renderBookings,
    payouts: renderPayouts,
  }

  /* ---- Main Render ---- */
  return (
    <>
      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: '#FFFFFF' }}>

        {/* ---- Desktop Sidebar ---- */}
        <aside style={{
          width: 240, position: 'fixed', top: 0, left: 0, bottom: 0,
          background: '#f5f5f7', borderRight: '1px solid #d2d2d7',
          display: 'flex', flexDirection: 'column', padding: '24px 0',
          zIndex: 50,
        }}
          className="owner-sidebar-desktop"
        >
          {/* Logo */}
          <div style={{ padding: '0 20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={22} color="#005bb5" />
            <span style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '1.125rem', color: '#1d1d1f', letterSpacing: '-0.02em',
            }}>TakeMe <span style={{ color: '#0071e3' }}>Fleet</span></span>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ITEMS.map(item => {
              const active = activeTab === item.key
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 20px', border: 'none', cursor: 'pointer',
                    background: active ? '#f0f5ff' : 'transparent',
                    color: active ? '#005bb5' : '#6e6e73',
                    fontSize: '0.9rem', fontWeight: 500, textAlign: 'left',
                    transition: 'color 0.2s, background 0.2s',
                    fontFamily: "'DM Sans', sans-serif",
                    borderRadius: 8,
                    margin: '0 8px',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget.style.color = '#1d1d1f') }}
                  onMouseLeave={e => { if (!active) (e.currentTarget.style.color = '#6e6e73') }}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* User */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #d2d2d7', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: '#f0f5ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#005bb5', fontSize: '0.75rem', fontWeight: 600,
              border: '1px solid #bfdbfe',
            }}>
              {(owner?.name ?? owner?.email ?? 'O').charAt(0).toUpperCase()}
            </div>
            <span style={{ color: '#6e6e73', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
              {owner?.email ?? 'Loading...'}
            </span>
          </div>
        </aside>

        {/* ---- Mobile Bottom Tabs ---- */}
        <nav
          className="owner-mobile-tabs"
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#FFFFFF', borderTop: '1px solid #d2d2d7',
            display: 'none', justifyContent: 'space-around', padding: '8px 0',
            zIndex: 50,
          }}
        >
          {NAV_ITEMS.map(item => {
            const active = activeTab === item.key
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: active ? '#005bb5' : '#86868b',
                  fontSize: '0.65rem', fontWeight: 500, padding: '4px 8px',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <Icon size={20} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* ---- Main Content ---- */}
        <main style={{
          flex: 1, marginLeft: 240, padding: 'clamp(24px, 4vw, 48px)',
          maxWidth: 1200, width: '100%', background: '#FFFFFF',
        }}
          className="owner-main-content"
        >
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}>
              {CONTENT[activeTab]()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .owner-sidebar-desktop { display: none !important; }
          .owner-mobile-tabs { display: flex !important; }
          .owner-main-content { margin-left: 0 !important; padding-bottom: 80px !important; }
        }
      `}</style>
    </>
  )
}
