'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useInView } from 'framer-motion'
import { Zap, Search, CalendarCheck, Car, Upload, ShieldCheck, DollarSign, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { VehicleCard } from '@/components/fleet/VehicleCard'
import { VehicleCardSkeleton } from '@/components/fleet/Skeleton'

/* ------------------------------------------------------------------ */
/*  Animated Counter                                                   */
/* ------------------------------------------------------------------ */
function AnimatedStat({ value, suffix, label }: { value: string; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const numericPart = parseInt(value.replace(/[^0-9]/g, ''), 10)
  const prefix = value.replace(/[0-9]+.*/, '')
  const trailChar = value.replace(/.*[0-9]/, '').replace(suffix ?? '', '')
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView) return
    let frame: number
    const duration = 1400
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setCount(Math.round(numericPart * ease))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [inView, numericPart])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="fleet-card"
      style={{ textAlign: 'center', padding: 32 }}
    >
      <div style={{
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 'clamp(2rem, 4vw, 3rem)',
        color: '#1D6AE5',
        letterSpacing: '-0.03em',
      }}>
        {prefix}{count}{trailChar}{suffix}
      </div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        color: '#6e6e73',
        fontSize: '1rem',
        marginTop: 4,
      }}>
        {label}
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function FleetPage() {
  /* ---- filters ---- */
  const [city, setCity] = useState('')
  const [vehicleType, setVehicleType] = useState('All')
  const [maxRate, setMaxRate] = useState(300)
  const [filters, setFilters] = useState<Record<string, string>>({})

  /* ---- vehicles ---- */
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  /* ---- how it works toggle ---- */
  const [howTab, setHowTab] = useState<'drivers' | 'owners'>('drivers')

  /* ---- refs ---- */
  const gridRef = useRef<HTMLDivElement>(null)

  /* ---- fetch ---- */
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.city) params.set('city', filters.city)
    if (filters.vehicleType && filters.vehicleType !== 'All') params.set('type', filters.vehicleType)
    if (filters.maxRate) params.set('maxPrice', String(Number(filters.maxRate) * 100))
    fetch(`/api/fleet/vehicles?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setVehicles(data.data?.vehicles ?? data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filters])

  const handleSearch = useCallback(() => {
    setFilters({ city, vehicleType, maxRate: String(maxRate) })
  }, [city, vehicleType, maxRate])

  const scrollToGrid = () => {
    gridRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  /* ---- stagger variants ---- */
  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12 } },
  }
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  }

  /* ================================================================ */
  return (
    <>
      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section style={{
        overflow: 'hidden',
        background: '#FFFFFF',
        paddingTop: 100,
        paddingBottom: 80,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(24px, 5vw, 80px)' }}>
          <div className="fleet-hero-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 64,
            alignItems: 'center',
          }}>
            {/* Left — text content */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              <motion.p variants={fadeUp} style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.15em',
                color: '#1D6AE5',
                marginBottom: 16,
              }}>
                TakeMe Fleet
              </motion.p>

              <motion.h1 variants={fadeUp} style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 'clamp(36px, 5vw, 60px)',
                color: '#1d1d1f',
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                margin: 0,
              }}>
                Drive Electric.
                <br />
                Earn More.
              </motion.h1>

              <motion.p variants={fadeUp} style={{
                fontFamily: "'DM Sans', sans-serif",
                color: '#6e6e73',
                fontSize: '1.125rem',
                marginTop: 20,
                marginBottom: 36,
                maxWidth: 420,
                lineHeight: 1.6,
              }}>
                Seattle&apos;s first premium EV sharing marketplace. List your EV or rent one — zero gas costs.
              </motion.p>

              <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="fleet-btn-primary" onClick={scrollToGrid} type="button">
                  Browse Vehicles
                </button>
                <Link href="/fleet/list-your-ev" style={{ textDecoration: 'none' }}>
                  <button className="fleet-btn-ghost" type="button">
                    List Your EV
                  </button>
                </Link>
              </motion.div>
            </motion.div>

            {/* Right — key metrics card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              style={{
                background: '#f5f5f7',
                borderRadius: 20,
                padding: '40px 36px',
              }}
            >
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#86868b', marginBottom: 28, marginTop: 0 }}>
                Platform at a glance
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {[
                  { value: '47+', label: 'EVs listed' },
                  { value: '$0', label: 'Gas costs' },
                  { value: '80%', label: 'Owner earnings' },
                  { value: '24/7', label: 'Support' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '2rem', color: '#1d1d1f', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {stat.value}
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', color: '#86868b', marginTop: 4 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .fleet-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          }
        `}</style>
      </section>

      {/* ============================================================ */}
      {/*  SEARCH / FILTER BAR                                         */}
      {/* ============================================================ */}
      <section style={{ padding: '48px clamp(24px, 5vw, 80px)', background: '#f5f5f7' }}>
        <div className="fleet-card" style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: 32,
        }}>
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}>
            {/* City */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.8rem', marginBottom: 6 }}>
                City
              </label>
              <select
                className="fleet-select"
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">All Cities</option>
                <option value="Seattle">Seattle</option>
                <option value="Bellevue">Bellevue</option>
                <option value="Tacoma">Tacoma</option>
                <option value="Redmond">Redmond</option>
              </select>
            </div>

            {/* Vehicle Type */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.8rem', marginBottom: 6 }}>
                Vehicle Type
              </label>
              <select
                className="fleet-select"
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="All">All</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Truck">Truck</option>
                <option value="Luxury">Luxury</option>
              </select>
            </div>

            {/* Max Daily Rate */}
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", color: '#6e6e73', fontSize: '0.8rem', marginBottom: 6 }}>
                Max Daily Rate: <span style={{ color: '#1D6AE5', fontWeight: 600 }}>${maxRate}</span>
              </label>
              <input
                type="range"
                min={30}
                max={300}
                step={10}
                value={maxRate}
                onChange={e => setMaxRate(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: '#1D6AE5',
                  cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans', sans-serif", color: '#86868b', fontSize: '0.7rem' }}>
                <span>$30</span>
                <span>$300</span>
              </div>
            </div>

            {/* Search */}
            <div style={{ flex: '0 0 auto' }}>
              <button className="fleet-btn-primary" onClick={handleSearch} type="button" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search size={16} />
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  VEHICLE GRID                                                */}
      {/* ============================================================ */}
      <section ref={gridRef} style={{ padding: '80px clamp(24px, 5vw, 80px)', background: '#FFFFFF' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <h2 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: '2.5rem',
            color: '#1d1d1f',
            margin: 0,
            letterSpacing: '-0.03em',
          }}>
            Available Now
          </h2>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            color: '#6e6e73',
            fontSize: '1.05rem',
            marginTop: 12,
          }}>
            Premium EVs ready for your next journey
          </p>
        </motion.div>

        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 24,
            maxWidth: 1200,
            margin: '0 auto',
          }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <VehicleCardSkeleton key={i} />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 24px',
          }}>
            <Zap size={48} color="#1D6AE5" style={{ marginBottom: 16 }} />
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              color: '#6e6e73',
              fontSize: '1.1rem',
            }}>
              No vehicles available yet
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 24,
            maxWidth: 1200,
            margin: '0 auto',
          }}>
            {vehicles.map((v: any, i: number) => (
              <VehicleCard
                key={v.id}
                id={v.id}
                make={v.make}
                model={v.model}
                year={v.year}
                dailyRateCents={v.daily_rate_cents}
                rangeMiles={v.range_miles}
                city={v.pickup_address ?? v.city ?? 'Seattle'}
                photos={v.photos ?? []}
                connectorType={v.connector_type}
                index={i}
              />
            ))}
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/*  STATS                                                       */}
      {/* ============================================================ */}
      <section style={{ padding: '80px clamp(24px, 5vw, 80px)', background: '#f5f5f7' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 32,
          maxWidth: 900,
          margin: '0 auto',
        }}>
          <AnimatedStat value="47+" suffix="+" label="EVs Listed" />
          <AnimatedStat value="$0" suffix="" label="Gas Costs" />
          <AnimatedStat value="24/7" suffix="" label="Support" />
        </div>
      </section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                */}
      {/* ============================================================ */}
      <section style={{ padding: '100px clamp(24px, 5vw, 80px)', background: '#FFFFFF' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <h2 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: '2.5rem',
            color: '#1d1d1f',
            margin: 0,
            letterSpacing: '-0.03em',
          }}>
            How It Works
          </h2>
        </motion.div>

        {/* toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 56,
        }}>
          <button
            onClick={() => setHowTab('drivers')}
            type="button"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.95rem',
              fontWeight: 600,
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: howTab === 'drivers' ? '#f0f5ff' : 'transparent',
              color: howTab === 'drivers' ? '#1D6AE5' : '#6e6e73',
            }}
          >
            For Drivers
          </button>
          <button
            onClick={() => setHowTab('owners')}
            type="button"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.95rem',
              fontWeight: 600,
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: howTab === 'owners' ? '#f0f5ff' : 'transparent',
              color: howTab === 'owners' ? '#1D6AE5' : '#6e6e73',
            }}
          >
            For Owners
          </button>
        </div>

        {/* steps */}
        <motion.div
          key={howTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 32,
            maxWidth: 1000,
            margin: '0 auto',
          }}
        >
          {howTab === 'drivers' ? (
            <>
              <StepCard num={1} icon={<Search size={28} color="#1D6AE5" />} title="Browse EVs" description="Explore our curated selection of premium electric vehicles available in your area." />
              <StepCard num={2} icon={<CalendarCheck size={28} color="#1D6AE5" />} title="Book Instantly" description="Reserve your vehicle in seconds with transparent pricing and flexible terms." />
              <StepCard num={3} icon={<Car size={28} color="#1D6AE5" />} title="Drive & Earn" description="Hit the road with zero gas costs and maximize your earnings as a rideshare driver." />
            </>
          ) : (
            <>
              <StepCard num={1} icon={<Upload size={28} color="#1D6AE5" />} title="List Your EV" description="Add your electric vehicle to the marketplace in minutes with our simple listing process." />
              <StepCard num={2} icon={<ShieldCheck size={28} color="#1D6AE5" />} title="Get Approved" description="Our team verifies your vehicle and sets you up for success with insurance and support." />
              <StepCard num={3} icon={<DollarSign size={28} color="#1D6AE5" />} title="Earn Passive Income" description="Your EV earns money while you sleep. Track earnings and manage bookings from your dashboard." />
            </>
          )}
        </motion.div>
      </section>

      {/* Footer rendered by root layout */}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Step Card                                                          */
/* ------------------------------------------------------------------ */
function StepCard({ num, icon, title, description }: {
  num: number
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: (num - 1) * 0.12 }}
      className="fleet-card"
      style={{ padding: 32, textAlign: 'center' }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: '#f0f5ff',
        color: '#1D6AE5',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        fontSize: '0.9rem',
        marginBottom: 20,
      }}>
        {num}
      </div>
      <div style={{ marginBottom: 16 }}>{icon}</div>
      <h3 style={{
        fontFamily: "'DM Serif Display', Georgia, serif",
        color: '#1d1d1f',
        fontSize: '1.25rem',
        margin: '0 0 8px',
        letterSpacing: '-0.02em',
      }}>
        {title}
      </h3>
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        color: '#6e6e73',
        fontSize: '0.9rem',
        lineHeight: 1.6,
        margin: 0,
      }}>
        {description}
      </p>
    </motion.div>
  )
}
