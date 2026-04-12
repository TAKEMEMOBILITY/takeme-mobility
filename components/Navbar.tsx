'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

const NAV_LINKS = [
  { label: 'TakeMe Fleet', href: '/fleet', badge: true },
  { label: 'Business', href: '/business', badge: false },
  { label: 'Insurance', href: '/insurance', badge: true },
  { label: 'TakeMe Connect', href: '/connect', badge: true },
  { label: 'Students Membership', href: '/students', badge: true },
  { label: 'Driver Hub', href: '/driver-hub', badge: true },
];

function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    let last = window.scrollY > threshold;
    setScrolled(last);
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > threshold;
        if (next !== last) {
          last = next;
          setScrolled(next);
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [threshold]);
  return scrolled;
}

export default function Navbar() {
  const { user, loading } = useAuth();
  const scrolled = useScrolled();
  const pathname = usePathname();

  const ctaHref = user ? '/dashboard' : '/auth/signup';
  const signInHref = user ? '/dashboard' : '/auth/login';

  return (
    <nav
      className={`fixed top-0 z-50 w-full ${
        scrolled ? 'bg-white/85 backdrop-blur-lg' : 'bg-white'
      }`}
      style={{ willChange: 'transform', transform: 'translateZ(0)', borderBottom: scrolled ? '1px solid #f5f5f7' : 'none' }}
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 lg:px-10">
        {/* LEFT — Logo */}
        <Link href="/" className="shrink-0 text-[17px] tracking-[0.01em] text-[#1d1d1f]">
          <span className="font-semibold">TakeMe</span>
          <span className="ml-[4px] font-light text-[#86868b]">Mobility</span>
        </Link>

        {/* CENTER — Nav links */}
        <div className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map(({ label, href, badge }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center whitespace-nowrap text-[13px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                {label}
                {badge && (
                  <span style={{ background: '#1D6AE5', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 4, letterSpacing: '0.5px' }}>
                    NEW
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* RIGHT — Auth + CTA */}
        <div className="flex shrink-0 items-center gap-4">
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-[#d2d2d7] border-t-[#1d1d1f]" />
          ) : (
            <>
              <Link
                href={signInHref}
                className="hidden text-[13px] font-medium text-[#86868b] transition-colors duration-200 hover:text-[#1d1d1f] sm:block"
              >
                Sign in
              </Link>
              <Link
                href={ctaHref}
                className="inline-flex h-9 items-center rounded-[999px] bg-[#1D6AE5] px-5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-[#1558C0]"
              >
                Book a ride
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
