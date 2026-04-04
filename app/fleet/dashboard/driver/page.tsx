'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  LayoutDashboard, Car, Calendar, DollarSign, Zap, Clock,
  Check, X, ChevronRight, Plus, Filter
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface User {
  id: string
  email: string
  name?: string
}

interface Booking {
  id: string
  vehicle_id: string
  vehicle?: { make: string; model: string; year: number; image_url?: string }
  driver_id: string
  start_date: string
  end_date: string
  total_amount: number
  status: string
  created_at: string
  pickup_address?: string
}

/* ------------------------------------------------------------------ */
/*  Skeleton shimmer                                                   */
/* ------------------------------------------------------------------ */
function Skeleton({ width, height }: { width?: string; height?: string }) {
  return (
    <div style={{
      width: width ?? '100%', height: height ?? '20px', borderRadius: 8,
      background: 'linear-gradient(90deg, #f5f5f7 25%, #d2d2d7 50%, #f5f5f7 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  )
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: 'fleet-badge fleet-badge-green',
    in_use: 'fleet-badge fleet-badge-red',
    completed: 'fleet-badge fleet-badge-gray',
    cancelled: 'fleet-badge fleet-badge-red',
    pickup_ready: 'fleet-badge fleet-badge-green',
    pending: 'fleet-badge fleet-badge-yellow',
  }
  return (
    <span className={map[status] ?? 'fleet-badge fleet-badge-gray'}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Countdown display                                                  */
/* ------------------------------------------------------------------ */
function Countdown({ endDate }: { endDate: string }) {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, new Date(endDate).getTime() - Date.now())
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const seconds = Math.floor((diff / 1000) % 60)
      setRemaining({ days, hours, minutes, seconds })
    }
    calc()
    const interval = setInterval(calc, 1000)
    return () => clearInterval(interval)
  }, [endDate])

  const units = [
    { label: 'Days', value: remaining.days },
    { label: 'Hours', value: remaining.hours },
    { label: 'Min', value: remaining.minutes },
    { label: 'Sec', value: remaining.seconds },
  ]

  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
      {units.map(u => (
        <div key={u.label} style={{ textAlign: 'center' }}>
          <motion.div
            key={u.value}
            initial={{ opacity: 0.7, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', color: '#005bb5',
              lineHeight: 1,
            }}
          >
            {String(u.value).padStart(2, '0')}
          </motion.div>
          <div style={{ color: '#6e6e73', fontSize: '0.7rem', marginTop: 4 }}>{u.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Eligibility check item                                             */
/* ------------------------------------------------------------------ */
function EligibilityItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: passed ? '#f0f5ff' : '#f0f5ff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {passed
          ? <Check size={14} color="#248a24" />
          : <X size={14} color="#005bb5" />
        }
      </div>
      <span style={{ color: passed ? '#6e6e73' : '#005bb5', fontSize: '0.9rem' }}>{label}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stagger container                                                  */
/* ------------------------------------------------------------------ */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function DriverDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [completingId, setCompletingId] = useState<string | null>(null)

  /* Auth + data fetch */
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setAuthError(true); setLoading(false); return }
        setUser(data)
        return fetch('/api/fleet/bookings')
      })
      .then(r => r?.json())
      .then(data => {
        if (data?.success && Array.isArray(data.data?.bookings)) setBookings(data.data.bookings)
        else if (data?.success && Array.isArray(data.data)) setBookings(data.data)
        else if (Array.isArray(data)) setBookings(data)
        setLoading(false)
      })
      .catch(() => { setAuthError(true); setLoading(false) })
  }, [])

  /* Complete return handler */
  const handleComplete = async (bookingId: string) => {
    setCompletingId(bookingId)
    try {
      const res = await fetch(`/api/fleet/bookings/${bookingId}/complete`, { method: 'POST' })
      const data = await res.json()
      if (data.success || res.ok) {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'completed' } : b))
      }
    } catch (err) {
      console.error('Failed to complete booking', err)
    } finally {
      setCompletingId(null)
    }
  }

  /* Categorize bookings */
  const activeStatuses = ['in_use', 'confirmed', 'pickup_ready']
  const activeBooking = bookings.find(b => activeStatuses.includes(b.status))
  const upcomingBookings = bookings.filter(b => ['confirmed', 'pickup_ready'].includes(b.status) && b.id !== activeBooking?.id)
  const pastBookings = bookings.filter(b => ['completed', 'cancelled'].includes(b.status))

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
        <p style={{ fontSize: '1.125rem', color: '#6e6e73' }}>Sign in to access your dashboard</p>
        <Link href="/auth/login" className="fleet-btn-primary" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 28px', borderRadius: 10, textDecoration: 'none', fontWeight: 600,
          background: '#0071e3', color: '#FFFFFF',
        }}>
          Sign In <ChevronRight size={16} />
        </Link>
      </div>
    )
  }

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          padding: 'clamp(24px, 5vw, 80px)',
          fontFamily: "'DM Sans', sans-serif",
          background: '#FFFFFF',
        }}>
          <Skeleton width="200px" height="28px" />
          <div style={{ marginTop: 24 }}><Skeleton height="200px" /></div>
          <div style={{ marginTop: 24 }}><Skeleton height="120px" /></div>
          <div style={{ marginTop: 24 }}><Skeleton height="120px" /></div>
        </div>
      </>
    )
  }

  /* ---- Empty state ---- */
  if (bookings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          maxWidth: 900, margin: '0 auto',
          padding: 'clamp(24px, 5vw, 80px)',
          fontFamily: "'DM Sans', sans-serif",
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', textAlign: 'center',
          background: '#FFFFFF',
        }}
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Car size={56} color="#86868b" />
        </motion.div>
        <h2 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '1.5rem', color: '#1d1d1f', marginTop: 20, marginBottom: 8,
        }}>
          No bookings yet
        </h2>
        <p style={{ color: '#6e6e73', marginBottom: 24, maxWidth: 320 }}>
          Browse our premium EV fleet and find your next ride
        </p>
        <Link href="/fleet" className="fleet-btn-primary" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 28px', borderRadius: 10, textDecoration: 'none', fontWeight: 600,
          background: '#0071e3', color: '#FFFFFF',
        }}>
          Browse Available EVs <ChevronRight size={16} />
        </Link>
      </motion.div>
    )
  }

  /* ---- Main Render ---- */
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{
          maxWidth: 900, margin: '0 auto',
          padding: 'clamp(24px, 5vw, 80px)',
          fontFamily: "'DM Sans', sans-serif",
          background: '#FFFFFF',
        }}
      >
        {/* Page heading */}
        <motion.h1
          variants={fadeUp}
          style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 'clamp(1.5rem, 4vw, 2rem)', color: '#1d1d1f',
            margin: '0 0 32px',
          }}
        >
          Your Rides
        </motion.h1>

        {/* ---- Active Booking ---- */}
        {activeBooking && (
          <motion.div
            variants={fadeUp}
            style={{
              padding: 'clamp(20px, 4vw, 32px)', marginBottom: 32,
              border: '2px solid #bfdbfe',
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <StatusBadge status={activeBooking.status} />
                  <span style={{ color: '#6e6e73', fontSize: '0.8rem' }}>Active Booking</span>
                </div>
                <h2 style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', color: '#1d1d1f', margin: 0,
                }}>
                  {activeBooking.vehicle
                    ? `${activeBooking.vehicle.year} ${activeBooking.vehicle.make} ${activeBooking.vehicle.model}`
                    : `Booking ${activeBooking.id.slice(0, 8)}`
                  }
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#6e6e73', fontSize: '0.8rem' }}>Total</div>
                <div style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: '1.5rem', color: '#005bb5',
                }}>${activeBooking.total_amount}</div>
              </div>
            </div>

            {/* Date range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: '#6e6e73', fontSize: '0.875rem' }}>
              <Calendar size={14} />
              <span>
                {new Date(activeBooking.start_date).toLocaleDateString()} — {new Date(activeBooking.end_date).toLocaleDateString()}
              </span>
            </div>

            {/* Pickup address */}
            {activeBooking.pickup_address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: '#6e6e73', fontSize: '0.8rem' }}>
                <Clock size={14} />
                <span>{activeBooking.pickup_address}</span>
              </div>
            )}

            {/* Countdown */}
            <div style={{ marginTop: 20 }}>
              <div style={{ color: '#6e6e73', fontSize: '0.8rem', marginBottom: 4 }}>Returns in</div>
              <Countdown endDate={activeBooking.end_date} />
            </div>

            {/* Complete button */}
            {activeBooking.status === 'in_use' && (
              <motion.button
                className="fleet-btn-primary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleComplete(activeBooking.id)}
                disabled={completingId === activeBooking.id}
                style={{
                  marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.9rem', fontFamily: "'DM Sans', sans-serif",
                  background: '#0071e3', color: '#FFFFFF',
                  opacity: completingId === activeBooking.id ? 0.6 : 1,
                }}
              >
                {completingId === activeBooking.id ? 'Completing...' : 'Complete Return'}
                <ChevronRight size={16} />
              </motion.button>
            )}
          </motion.div>
        )}

        {/* ---- Upcoming Bookings ---- */}
        {upcomingBookings.length > 0 && (
          <motion.div variants={fadeUp} style={{ marginBottom: 32 }}>
            <h3 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '1.25rem', color: '#1d1d1f', margin: '0 0 16px',
            }}>Upcoming</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upcomingBookings.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  style={{
                    padding: 20, display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', flexWrap: 'wrap', gap: 12,
                    background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12,
                  }}
                >
                  <div>
                    <div style={{ color: '#1d1d1f', fontWeight: 600, marginBottom: 4 }}>
                      {b.vehicle
                        ? `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}`
                        : `Booking ${b.id.slice(0, 8)}`
                      }
                    </div>
                    <div style={{ color: '#6e6e73', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={12} />
                      {new Date(b.start_date).toLocaleDateString()} — {new Date(b.end_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: '#1d1d1f', fontWeight: 600 }}>${b.total_amount}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ---- Past Bookings ---- */}
        {pastBookings.length > 0 && (
          <motion.div variants={fadeUp} style={{ marginBottom: 32 }}>
            <h3 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '1.25rem', color: '#1d1d1f', margin: '0 0 16px',
            }}>History</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pastBookings.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  style={{
                    padding: '14px 20px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', flexWrap: 'wrap', gap: 8,
                    background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span style={{ color: '#6e6e73', fontSize: '0.875rem', fontWeight: 500 }}>
                      {b.vehicle
                        ? `${b.vehicle.make} ${b.vehicle.model}`
                        : b.id.slice(0, 8)
                      }
                    </span>
                    <span style={{ color: '#86868b', fontSize: '0.75rem' }}>
                      {new Date(b.start_date).toLocaleDateString()} — {new Date(b.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#6e6e73', fontSize: '0.875rem' }}>${b.total_amount}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ---- Eligibility Status ---- */}
        <motion.div
          variants={fadeUp}
          style={{
            padding: 'clamp(20px, 4vw, 28px)', marginBottom: 32,
            background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 12,
          }}
        >
          <h3 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: '1.125rem', color: '#1d1d1f', margin: '0 0 16px',
          }}>Your Driver Profile</h3>
          <EligibilityItem label="License verified" passed={true} />
          <EligibilityItem label="Age requirement met" passed={true} />
          <EligibilityItem label="Payment method on file" passed={true} />
          <EligibilityItem label="Rental agreement accepted" passed={false} />
        </motion.div>
      </motion.div>
    </>
  )
}
