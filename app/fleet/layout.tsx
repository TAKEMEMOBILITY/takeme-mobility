import { FleetNav } from '@/components/fleet/FleetNav'

export const metadata = {
  title: 'TakeMe Fleet — Premium EV Sharing Marketplace',
  description: "Seattle's first premium EV sharing marketplace. Browse, book, and drive electric.",
}

export default function FleetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <FleetNav />
      <main>{children}</main>
    </div>
  )
}
