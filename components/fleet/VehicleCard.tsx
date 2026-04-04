'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Zap, MapPin } from 'lucide-react'

interface VehicleCardProps {
  id: string
  make: string
  model: string
  year: number
  dailyRateCents: number
  rangeMiles: number | null
  city: string
  photos: string[]
  connectorType: string | null
  index?: number
}

export function VehicleCard({
  id, make, model, year, dailyRateCents, rangeMiles,
  city, photos, connectorType, index = 0,
}: VehicleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] as const }}
    >
      <Link href={`/fleet/vehicles/${id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div className="fleet-card" style={{ overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{ position: 'relative', height: 200, background: '#f5f5f7', overflow: 'hidden' }}>
            {photos[0] ? (
              <img
                src={photos[0]}
                alt={`${year} ${make} ${model}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', background: '#f5f5f7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={40} color="#d2d2d7" />
              </div>
            )}
            {connectorType && (
              <div style={{ position: 'absolute', top: 12, right: 12 }}>
                <span className="fleet-badge fleet-badge-gray">
                  <Zap size={10} />
                  {connectorType.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div style={{ padding: '16px 20px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: '1.125rem', color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em',
                }}>
                  {year} {make}
                </h3>
                <p style={{ fontFamily: "'DM Sans'", color: '#6e6e73', fontSize: '0.875rem', margin: '2px 0 0' }}>
                  {model}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: '1.375rem', color: '#005bb5', letterSpacing: '-0.02em',
                }}>
                  ${(dailyRateCents / 100).toFixed(0)}
                </div>
                <div style={{ fontFamily: "'DM Sans'", color: '#86868b', fontSize: '0.75rem' }}>per day</div>
              </div>
            </div>

            <div style={{
              display: 'flex', gap: 16, marginTop: 14, paddingTop: 14,
              borderTop: '1px solid #f5f5f7',
            }}>
              {rangeMiles && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6e6e73', fontFamily: "'DM Sans'", fontSize: '0.8rem' }}>
                  <Zap size={12} color="#86868b" />
                  {rangeMiles} mi
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6e6e73', fontFamily: "'DM Sans'", fontSize: '0.8rem' }}>
                <MapPin size={12} color="#86868b" />
                {city || 'Seattle'}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
