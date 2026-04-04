'use client'

import Link from 'next/link'

const PRODUCTS = [
  { label: 'TakeMe Rides', href: '/' },
  { label: 'TakeMe Fleet', href: '/fleet' },
  { label: 'TakeMe Connect', href: '/connect' },
  { label: 'Students Membership', href: '/students' },
  { label: 'TakeMe Business', href: '/business' },
]

const COMPANY = [
  { label: 'About Us', href: '/about' },
  { label: 'Driver Hub', href: '/driver-hub' },
  { label: 'Drive with Us', href: '/driver/apply' },
  { label: 'Safety', href: '/safety' },
  { label: 'Newsroom', href: '/newsroom' },
]

const SUPPORT = [
  { label: 'Help Center', href: '/help' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
]

function SocialIcon({ path, label }: { path: string; label: string }) {
  return (
    <a
      href="#"
      aria-label={label}
      style={{ color: '#6e6e73', transition: 'color 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#1D6AE5')}
      onMouseLeave={e => (e.currentTarget.style.color = '#6e6e73')}
    >
      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d={path} /></svg>
    </a>
  )
}

function FooterColumn({ heading, links }: { heading: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p style={{
        fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
        color: '#6e6e73', margin: '0 0 20px',
      }}>
        {heading}
      </p>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {links.map(l => (
          <Link
            key={l.label}
            href={l.href}
            style={{ fontSize: 14, color: '#1d1d1f', textDecoration: 'none', transition: 'color 0.15s ease' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1D6AE5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#1d1d1f')}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export default function Footer() {
  return (
    <footer>
      {/* Main footer */}
      <div style={{ background: '#f5f5f7', borderTop: '1px solid #d2d2d7' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '64px 24px',
          display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 48,
        }} className="footer-grid">
          {/* Brand */}
          <div>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                TakeMe
              </span>
              <span style={{ fontSize: 18, fontWeight: 300, color: '#86868b', marginLeft: 5 }}>
                Mobility
              </span>
            </Link>
            <p style={{ fontSize: 14, color: '#6e6e73', marginTop: 12, lineHeight: 1.6 }}>
              Get anywhere in minutes.
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
              <SocialIcon label="X" path="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              <SocialIcon label="LinkedIn" path="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              <SocialIcon label="Instagram" path="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              <SocialIcon label="YouTube" path="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </div>
          </div>

          <FooterColumn heading="Products" links={PRODUCTS} />
          <FooterColumn heading="Company" links={COMPANY} />
          <FooterColumn heading="Support" links={SUPPORT} />
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ background: '#ffffff', borderTop: '1px solid #d2d2d7' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <p style={{ fontSize: 13, color: '#86868b', margin: 0 }}>
            &copy; 2026 TakeMe Mobility LLC. All rights reserved.
          </p>
          <p style={{ fontSize: 13, color: '#86868b', margin: 0 }}>
            Seattle, WA &middot; Made with &hearts; for drivers and riders
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; row-gap: 40px !important; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  )
}
