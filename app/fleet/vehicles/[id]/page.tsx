'use client'
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap, MapPin, Battery, Gauge, Calendar, Shield, ChevronLeft, ChevronRight, Check, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/fleet/Skeleton'

interface VehiclePhoto {
  file_url: string
  photo_type: string
}

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  color: string
  body_type: string
  range_miles: number
  connector_type: string
  battery_capacity_kwh: number
  charge_speed_kw: number
  daily_rate_cents: number
  weekly_rate_cents: number
  monthly_rate_cents: number
  deposit_amount_cents: number
  cleaning_fee_cents: number
  min_driver_age: number
  min_rental_days: number
  pickup_address: string
  accessories: string[] | null
  owner_notes: string | null
  vehicle_photos: VehiclePhoto[]
}

type BookingState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; bookingId: string }
  | { status: 'error'; message: string }

function usd(cents: number) {
  return `$${(cents / 100).toFixed(0)}`
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(Math.ceil(ms / (1000 * 60 * 60 * 24)), 0)
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const [activePhoto, setActivePhoto] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [bookingState, setBookingState] = useState<BookingState>({ status: 'idle' })

  useEffect(() => {
    fetch(`/api/fleet/vehicles/${id}`)
      .then(r => r.json())
      .then(data => {
        setVehicle(data.data ?? data)
        setLoading(false)
      })
      .catch(() => {
        setFetchError(true)
        setLoading(false)
      })
  }, [id])

  const photos = vehicle?.vehicle_photos ?? []
  const days = startDate && endDate ? daysBetween(startDate, endDate) : 0
  const baseTotal = days * (vehicle?.daily_rate_cents ?? 0)
  const cleaningFee = vehicle?.cleaning_fee_cents ?? 0
  const deposit = vehicle?.deposit_amount_cents ?? 0
  const total = baseTotal + cleaningFee + deposit

  const today = new Date().toISOString().split('T')[0]

  async function handleBook() {
    if (!vehicle || days <= 0) return
    setBookingState({ status: 'loading' })

    try {
      const eligRes = await fetch('/api/fleet/eligibility/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: vehicle.id }),
      })
      const eligData = await eligRes.json()

      if (!eligRes.ok || eligData.eligible === false) {
        setBookingState({
          status: 'error',
          message: eligData.reason ?? eligData.message ?? 'You are not eligible to book this vehicle.',
        })
        return
      }

      const bookRes = await fetch('/api/fleet/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          startDate,
          endDate,
        }),
      })
      const bookData = await bookRes.json()

      if (!bookRes.ok) {
        setBookingState({
          status: 'error',
          message: bookData.message ?? 'Booking failed. Please try again.',
        })
        return
      }

      setBookingState({
        status: 'success',
        bookingId: bookData.data?.id ?? bookData.id ?? bookData.bookingId ?? 'confirmed',
      })
    } catch {
      setBookingState({ status: 'error', message: 'Network error. Please try again.' })
    }
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          minHeight: '100vh',
          background: '#FFFFFF',
          padding: '96px clamp(24px, 5vw, 80px) 60px',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Skeleton width={120} height={20} />
          <div style={{ marginTop: 24 }}>
            <Skeleton width="100%" height={400} borderRadius={24} />
          </div>
          <div style={{ marginTop: 24 }}>
            <Skeleton width={300} height={40} />
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Skeleton width="100%" height={90} borderRadius={16} />
            <Skeleton width="100%" height={90} borderRadius={16} />
            <Skeleton width="100%" height={90} borderRadius={16} />
            <Skeleton width="100%" height={90} borderRadius={16} />
          </div>
        </div>
      </motion.div>
    )
  }

  if (fetchError || !vehicle) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <X style={{ color: '#005bb5', width: 48, height: 48 }} />
        <p style={{ color: '#1d1d1f', fontSize: '1.25rem' }}>Vehicle not found</p>
        <Link href="/fleet" className="fleet-btn-ghost" style={{ marginTop: 8 }}>
          <ChevronLeft style={{ width: 16, height: 16 }} /> Back to listings
        </Link>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        fontFamily: "'DM Sans', sans-serif",
        padding: '96px clamp(24px, 5vw, 80px) 60px',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Back link */}
        <Link
          href="/fleet"
          className="fleet-btn-ghost"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 32,
            fontSize: 14,
            color: '#6e6e73',
            textDecoration: 'none',
          }}
        >
          <ChevronLeft style={{ width: 16, height: 16 }} /> Back to listings
        </Link>

        {/* Two column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 400px',
            gap: 40,
          }}
          className="vehicle-detail-grid"
        >
          {/* ==================== LEFT COLUMN ==================== */}
          <div>
            {/* Photo Gallery */}
            <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', aspectRatio: '16/9', background: '#f5f5f7' }}>
              {photos.length > 0 ? (
                <motion.img
                  key={activePhoto}
                  src={photos[activePhoto].file_url}
                  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: '#f5f5f7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Zap style={{ width: 64, height: 64, color: '#d2d2d7' }} />
                </div>
              )}

              {/* Prev / Next arrows */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setActivePhoto(prev => (prev - 1 + photos.length) % photos.length)}
                    style={{
                      position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      width: 40, height: 40, borderRadius: '50%', border: '1px solid #d2d2d7',
                      background: '#FFFFFF', color: '#1d1d1f', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft style={{ width: 20, height: 20 }} />
                  </button>
                  <button
                    onClick={() => setActivePhoto(prev => (prev + 1) % photos.length)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      width: 40, height: 40, borderRadius: '50%', border: '1px solid #d2d2d7',
                      background: '#FFFFFF', color: '#1d1d1f', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                    aria-label="Next photo"
                  >
                    <ChevronRight style={{ width: 20, height: 20 }} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div style={{
                display: 'flex',
                gap: 8,
                marginTop: 12,
                overflowX: 'auto',
                paddingBottom: 4,
              }}>
                {photos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhoto(idx)}
                    style={{
                      flex: '0 0 80px',
                      width: 80,
                      height: 56,
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: idx === activePhoto ? '2px solid #005bb5' : '2px solid #d2d2d7',
                      cursor: 'pointer',
                      opacity: idx === activePhoto ? 1 : 0.6,
                      transition: 'opacity 0.2s, border-color 0.2s',
                      padding: 0,
                      background: 'none',
                    }}
                  >
                    <img
                      src={photo.file_url}
                      alt={`Thumbnail ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Vehicle Title */}
            <h1 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '2.5rem',
              color: '#1d1d1f',
              marginTop: 32,
              marginBottom: 12,
              lineHeight: 1.15,
            }}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {vehicle.body_type && (
                <span className="fleet-badge fleet-badge-gray">{vehicle.body_type}</span>
              )}
              {vehicle.connector_type && (
                <span className="fleet-badge fleet-badge-gray">{vehicle.connector_type}</span>
              )}
              {vehicle.range_miles > 0 && (
                <span className="fleet-badge fleet-badge-gray">{vehicle.range_miles} mi range</span>
              )}
            </div>

            {/* Specs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
              <div style={{
                padding: 20,
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid #d2d2d7',
              }}>
                <Battery style={{ width: 22, height: 22, color: '#005bb5', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: '#86868b', marginBottom: 4 }}>Battery</p>
                <p style={{ fontSize: 18, color: '#1d1d1f', fontWeight: 600 }}>{vehicle.battery_capacity_kwh} kWh</p>
              </div>
              <div style={{
                padding: 20,
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid #d2d2d7',
              }}>
                <Gauge style={{ width: 22, height: 22, color: '#005bb5', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: '#86868b', marginBottom: 4 }}>Range</p>
                <p style={{ fontSize: 18, color: '#1d1d1f', fontWeight: 600 }}>{vehicle.range_miles} mi</p>
              </div>
              <div style={{
                padding: 20,
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid #d2d2d7',
              }}>
                <Zap style={{ width: 22, height: 22, color: '#005bb5', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: '#86868b', marginBottom: 4 }}>Connector</p>
                <p style={{ fontSize: 18, color: '#1d1d1f', fontWeight: 600 }}>{vehicle.connector_type}</p>
              </div>
              <div style={{
                padding: 20,
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid #d2d2d7',
              }}>
                <Shield style={{ width: 22, height: 22, color: '#005bb5', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: '#86868b', marginBottom: 4 }}>Min Age</p>
                <p style={{ fontSize: 18, color: '#1d1d1f', fontWeight: 600 }}>{vehicle.min_driver_age}+</p>
              </div>
            </div>

            {/* Location */}
            {vehicle.pickup_address && (
              <div
                style={{
                  padding: 20,
                  background: '#f5f5f7',
                  borderRadius: 16,
                  border: '1px solid #d2d2d7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 32,
                }}
              >
                <MapPin style={{ width: 20, height: 20, color: '#005bb5', flexShrink: 0 }} />
                <p style={{ fontSize: 15, color: '#6e6e73' }}>{vehicle.pickup_address}</p>
              </div>
            )}

            {/* Accessories */}
            {vehicle.accessories && vehicle.accessories.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: '1.25rem',
                  color: '#1d1d1f',
                  marginBottom: 12,
                }}>
                  Accessories
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {vehicle.accessories.map((acc, idx) => (
                    <span key={idx} className="fleet-badge fleet-badge-gray" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check style={{ width: 14, height: 14, color: '#005bb5' }} />
                      {acc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Owner Notes */}
            {vehicle.owner_notes && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: '1.25rem',
                  color: '#1d1d1f',
                  marginBottom: 12,
                }}>
                  Owner Notes
                </h3>
                <p style={{
                  fontSize: 15,
                  color: '#6e6e73',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  {vehicle.owner_notes}
                </p>
              </div>
            )}
          </div>

          {/* ==================== RIGHT COLUMN ==================== */}
          <div>
            <div
              style={{
                padding: 32,
                position: 'sticky',
                top: 96,
                background: '#FFFFFF',
                borderRadius: 20,
                border: '1px solid #d2d2d7',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              }}
            >
              {/* Price */}
              <p style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: '2rem',
                color: '#005bb5',
                marginBottom: 4,
              }}>
                {usd(vehicle.daily_rate_cents)}<span style={{ fontSize: 16, color: '#86868b', fontFamily: "'DM Sans', sans-serif" }}>/day</span>
              </p>
              {vehicle.weekly_rate_cents > 0 && (
                <p style={{ fontSize: 14, color: '#86868b', marginBottom: 8 }}>
                  {usd(vehicle.weekly_rate_cents)}/week
                </p>
              )}

              <div style={{ height: 1, background: '#d2d2d7', margin: '20px 0' }} />

              {/* Date Picker */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#6e6e73', marginBottom: 6 }}>
                  <Calendar style={{ width: 14, height: 14, display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                  Start Date
                </label>
                <input
                  type="date"
                  className="fleet-input"
                  value={startDate}
                  min={today}
                  onChange={e => {
                    setStartDate(e.target.value)
                    if (endDate && e.target.value > endDate) setEndDate('')
                    setBookingState({ status: 'idle' })
                  }}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#6e6e73', marginBottom: 6 }}>
                  <Calendar style={{ width: 14, height: 14, display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                  End Date
                </label>
                <input
                  type="date"
                  className="fleet-input"
                  value={endDate}
                  min={startDate || today}
                  onChange={e => {
                    setEndDate(e.target.value)
                    setBookingState({ status: 'idle' })
                  }}
                  style={{ width: '100%' }}
                />
              </div>

              {days > 0 && (
                <p style={{ fontSize: 14, color: '#6e6e73', marginBottom: 20, textAlign: 'center' }}>
                  {days} day{days !== 1 ? 's' : ''}
                </p>
              )}

              {/* Price Breakdown */}
              {days > 0 && vehicle && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden', marginBottom: 20 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#6e6e73', marginBottom: 10 }}>
                    <span>{usd(vehicle.daily_rate_cents)} x {days} day{days !== 1 ? 's' : ''}</span>
                    <span>{usd(baseTotal)}</span>
                  </div>
                  {cleaningFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#6e6e73', marginBottom: 10 }}>
                      <span>Cleaning fee</span>
                      <span>{usd(cleaningFee)}</span>
                    </div>
                  )}
                  {deposit > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#6e6e73', marginBottom: 10 }}>
                      <span>Security deposit <span style={{ fontSize: 11, color: '#86868b' }}>(refundable)</span></span>
                      <span>{usd(deposit)}</span>
                    </div>
                  )}
                  <div style={{ height: 1, background: '#d2d2d7', margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, color: '#1d1d1f', fontWeight: 600 }}>Total</span>
                    <span style={{
                      fontFamily: "'DM Serif Display', Georgia, serif",
                      fontSize: '1.5rem',
                      color: '#1d1d1f',
                      fontWeight: 700,
                    }}>
                      {usd(total)}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Book Button */}
              <button
                className="fleet-btn-primary"
                disabled={days <= 0 || bookingState.status === 'loading' || bookingState.status === 'success'}
                onClick={handleBook}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: '#1D6AE5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 12,
                  opacity: days <= 0 ? 0.4 : 1,
                  cursor: days <= 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {bookingState.status === 'loading' ? (
                  <>
                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    Checking...
                  </>
                ) : bookingState.status === 'success' ? (
                  <>
                    <Check style={{ width: 18, height: 18 }} />
                    Booked!
                  </>
                ) : (
                  'Check Eligibility & Book'
                )}
              </button>

              {/* Success State */}
              {bookingState.status === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 12,
                    background: '#e8fae8',
                    border: '1px solid #BBF7D0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Check style={{ width: 20, height: 20, color: '#248a24', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 14, color: '#248a24', fontWeight: 600 }}>Booking confirmed!</p>
                    <p style={{ fontSize: 12, color: '#6e6e73', marginTop: 2 }}>
                      ID: {bookingState.bookingId}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Error State */}
              {bookingState.status === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 12,
                    background: '#f0f5ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <X style={{ width: 20, height: 20, color: '#005bb5', flexShrink: 0 }} />
                  <p style={{ fontSize: 14, color: '#005bb5' }}>{bookingState.message}</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive + spinner animation styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 900px) {
          .vehicle-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </motion.div>
  )
}
