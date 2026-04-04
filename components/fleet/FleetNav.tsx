'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const links = [
  { href: '/fleet', label: 'Browse' },
  { href: '/fleet/list-your-ev', label: 'List Your EV' },
  { href: '/fleet/dashboard/owner', label: 'Dashboard' },
]

export function FleetNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: '0 clamp(20px, 4vw, 40px)',
          background: scrolled ? 'rgba(255,255,255,0.95)' : '#FFFFFF',
          borderBottom: scrolled ? '1px solid #d2d2d7' : '1px solid transparent',
          transition: 'all 300ms ease',
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a
            href="https://www.takememobility.com"
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem',
              color: '#86868b', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'color 150ms ease', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#6e6e73')}
            onMouseLeave={e => (e.currentTarget.style.color = '#86868b')}
          >
            <span style={{ fontSize: '0.75rem' }}>&larr;</span> TakeMe
          </a>
          <div style={{ width: 1, height: 16, background: '#d2d2d7' }} />
          <Link href="/fleet" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '1.2rem', color: '#1d1d1f', letterSpacing: '-0.02em',
            }}>
              TakeMe <span style={{ color: '#1D6AE5' }}>Fleet</span>
            </span>
          </Link>
        </div>

        {/* Desktop nav */}
        <div className="fleet-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {links.map(({ href, label }) => (
            <Link key={href} href={href} style={{
              padding: '8px 16px', borderRadius: 8,
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', fontWeight: 500,
              color: pathname === href ? '#005bb5' : '#6e6e73',
              background: pathname === href ? '#f0f5ff' : 'transparent',
              textDecoration: 'none', transition: 'all 150ms ease',
            }}>
              {label}
            </Link>
          ))}
          <div style={{ width: 1, height: 20, background: '#d2d2d7', margin: '0 8px' }} />
          <Link href="/fleet/list-your-ev" className="fleet-btn-primary" style={{ fontSize: '0.875rem', padding: '10px 22px' }}>
            Start Earning
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="fleet-nav-mobile"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'none', background: 'none', border: 'none', cursor: 'pointer',
            color: '#1d1d1f', padding: 8,
          }}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: '80vw', maxWidth: 320,
              background: '#FFFFFF', borderLeft: '1px solid #d2d2d7',
              zIndex: 200, padding: '80px 24px 24px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            {links.map(({ href, label }) => (
              <Link
                key={href} href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: '14px 20px', borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', fontWeight: 500,
                  color: pathname === href ? '#005bb5' : '#6e6e73',
                  background: pathname === href ? '#f0f5ff' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                {label}
              </Link>
            ))}
            <div style={{ marginTop: 16 }}>
              <Link href="/fleet/list-your-ev" className="fleet-btn-primary"
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', textAlign: 'center' }}>
                Start Earning
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150 }}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .fleet-nav-desktop { display: none !important; }
          .fleet-nav-mobile { display: block !important; }
        }
      `}</style>
    </>
  )
}
