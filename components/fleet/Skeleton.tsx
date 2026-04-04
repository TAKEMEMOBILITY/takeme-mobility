'use client'

export function Skeleton({ width = '100%', height = 20, borderRadius = 8 }: {
  width?: string | number
  height?: string | number
  borderRadius?: number
}) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, #f5f5f7 25%, #d2d2d7 50%, #f5f5f7 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  )
}

export function VehicleCardSkeleton() {
  return (
    <div className="fleet-card" style={{ overflow: 'hidden' }}>
      <Skeleton width="100%" height={200} borderRadius={0} />
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <Skeleton width={140} height={20} />
            <div style={{ marginTop: 6 }}><Skeleton width={80} height={16} /></div>
          </div>
          <Skeleton width={60} height={28} />
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f5f5f7', display: 'flex', gap: 16 }}>
          <Skeleton width={80} height={14} />
          <Skeleton width={70} height={14} />
        </div>
      </div>
    </div>
  )
}

export function StatSkeleton() {
  return (
    <div className="fleet-card" style={{ padding: 24 }}>
      <Skeleton width={60} height={14} />
      <div style={{ marginTop: 8 }}><Skeleton width={100} height={28} /></div>
    </div>
  )
}
