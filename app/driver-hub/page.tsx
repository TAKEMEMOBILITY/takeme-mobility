'use client'

import Link from 'next/link'
import { useRef, useState, useEffect, useCallback } from 'react'

/* ── Scroll reveal hook ──────────────────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Section({ children, className = '', bg = '' }: { children: React.ReactNode; className?: string; bg?: string }) {
  const { ref, visible } = useReveal(0.12)
  return (
    <div
      ref={ref}
      className={`transition-all duration-[900ms] ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ background: bg }}
    >
      {children}
    </div>
  )
}

/* ── Data ─────────────────────────────────────────────────────────────── */

const STATS = [
  { value: '24/7', label: 'Hub Access' },
  { value: '$0', label: 'Membership Fee' },
  { value: '5sec', label: 'QR Entry' },
  { value: '∞', label: 'Charging & Coffee' },
]

const QR_FEATURES = [
  { title: 'QR Entry', desc: 'Your phone is your key. No cards, no fobs, no waiting.' },
  { title: '5-Second Access', desc: 'Scan once at the door. You are in before you finish breathing.' },
  { title: 'Real-Time Security', desc: 'Every scan logged. Every entry tracked. You are always safe.' },
  { title: 'Entry/Exit Tracking', desc: 'Know exactly when you arrived and when you left.' },
]

const AMENITIES = [
  { title: 'Premium Lounge', desc: 'Leather seating, ambient lighting, your space to decompress.', img: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80' },
  { title: 'Coffee & Tea Bar', desc: 'Barista-quality espresso and premium teas. Always fresh, always free.', img: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80' },
  { title: 'Fast Charging Station', desc: '100W USB-C and wireless charging. Full battery in under an hour.', img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&q=80' },
  { title: 'Private Rest Pods', desc: 'Sound-isolated pods for a 20-minute reset between rides.', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80' },
  { title: 'High-Speed WiFi', desc: 'Enterprise-grade WiFi. Stream, download, update — no throttling.', img: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&q=80' },
  { title: 'Clean Restrooms', desc: 'Spotless, climate-controlled, restocked every hour.', img: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80' },
]

const BEFORE = [
  'Parking stress — circling blocks for 20 minutes',
  'No rest area — eating in your car between rides',
  'Dead phone battery — no charger, no next ride',
  'No bathroom — driving across town for a restroom',
  'City noise — no quiet space to take a break',
  'Weather exposure — rain, heat, nowhere to go',
]

const AFTER = [
  'QR access lounge — walk in, sit down, relax',
  'Premium coffee — barista-quality, unlimited, free',
  '100W charging — full battery in under an hour',
  'Private rest pods — 20-minute reset, sound-isolated',
  'Silent zone — no noise, no interruptions',
  'Climate controlled — 72°F year-round',
]

const STEPS = [
  { num: '01', title: 'Apply', desc: 'Submit your driver application in under 3 minutes.' },
  { num: '02', title: 'Verify', desc: 'Complete background check and vehicle inspection.' },
  { num: '03', title: 'Get QR', desc: 'Receive your personal QR code for hub access.' },
  { num: '04', title: 'Access Hub', desc: 'Walk in anytime, 24/7. Your hub, your schedule.' },
]

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function DriverHubPage() {
  const exploreRef = useRef<HTMLDivElement>(null)
  const scrollToExplore = useCallback(() => {
    exploreRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div style={{ background: '#ffffff', color: '#1d1d1f', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ═══ GOOGLE FONT ══════════════════════════════════════════════════ */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap" />

      {/* ═══ NAV ═════════════════════════════════════════════════════════ */}
      <header style={{ borderBottom: '1px solid #d2d2d7', background: '#ffffff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
          <Link href="/" style={{ fontSize: 18, color: '#1d1d1f', textDecoration: 'none', letterSpacing: '0.01em' }}>
            <span style={{ fontWeight: 600 }}>TakeMe</span>
            <span style={{ marginLeft: 5, fontWeight: 300, color: '#1D6AE5' }}>Driver Hub</span>
          </Link>
          <Link href="/" style={{ fontSize: 14, fontWeight: 500, color: '#86868b', textDecoration: 'none', transition: 'color 0.2s' }}>
            &larr; Back to home
          </Link>
        </div>
      </header>

      {/* ═══ HERO ════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Background image */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'url(https://images.unsplash.com/photo-1497366216548-37526070297c?w=1800&q=80)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.85) 100%)' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1200, margin: '0 auto', padding: '0 24px', width: '100%' }}>
          <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>
            TakeMe Driver Hub
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(40px, 6vw, 80px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0, maxWidth: 700, color: '#ffffff' }}>
            Your city.<br />Your home base.
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'rgba(255,255,255,0.75)', marginTop: 24, maxWidth: 520 }}>
            Seattle&apos;s most advanced driver center. Away from the city chaos — focus on driving.
          </p>

          <div style={{ display: 'flex', gap: 14, marginTop: 40, flexWrap: 'wrap' }}>
            <Link href="/driver/apply" style={{
              display: 'inline-flex', alignItems: 'center', height: 52,
              padding: '0 32px', borderRadius: 8, fontWeight: 600, fontSize: 16,
              background: '#1D6AE5', color: '#ffffff', textDecoration: 'none',
              transition: 'opacity 0.3s',
            }}>
              Apply Now
            </Link>
            <button onClick={scrollToExplore} type="button" style={{
              display: 'inline-flex', alignItems: 'center', height: 52,
              padding: '0 32px', borderRadius: 8, fontWeight: 500, fontSize: 16,
              background: 'transparent', color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.4)', cursor: 'pointer',
              transition: 'border-color 0.3s, background 0.3s',
            }}>
              Explore the Hub
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
          borderTop: '1px solid #d2d2d7',
          background: '#ffffff',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {STATS.map((s, i) => (
              <div key={i} style={{
                textAlign: 'center', padding: '24px 16px',
                borderLeft: i > 0 ? '1px solid #d2d2d7' : 'none',
              }}>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#1D6AE5' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#86868b', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INTRO ═══════════════════════════════════════════════════════ */}
      <Section bg="#ffffff">
        <div ref={exploreRef} style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="dh-grid">
          <div style={{ borderRadius: 16, overflow: 'hidden', aspectRatio: '4/3' }}>
            <img src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&q=80" alt="TakeMe Hub interior" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
          </div>
          <div>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#86868b', marginBottom: 16 }}>
              Why We Built This
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.025em', margin: '0 0 24px', color: '#1d1d1f' }}>
              Drivers deserve better than city chaos.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: '#6e6e73', margin: 0 }}>
              No parking. Dead phones. Nowhere to rest. Eating in your car between rides. We saw the reality — and built a space that treats drivers like the professionals they are.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: '#6e6e73', marginTop: 20 }}>
              The TakeMe Driver Hub is a private, 24/7 facility with fast charging, premium coffee, rest pods, and clean restrooms. Your QR code gets you in. No membership fees. No catches.
            </p>
          </div>
        </div>
      </Section>

      {/* ═══ QR ACCESS ════════════════════════════════════════════════════ */}
      <Section bg="#f5f5f7">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="dh-grid">
          <div>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#86868b', marginBottom: 16 }}>
              Keyless Entry
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.025em', margin: '0 0 40px', color: '#1d1d1f' }}>
              Your phone is your key.
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {QR_FEATURES.map((f) => (
                <div key={f.title} style={{
                  background: '#ffffff', border: '1px solid #d2d2d7',
                  borderRadius: 12, padding: 20,
                  transition: 'border-color 0.3s',
                }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: '#1d1d1f' }}>{f.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: '#86868b', margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* QR Code visual */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 280, height: 280, borderRadius: 24,
              background: '#ffffff', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              border: '1px solid #d2d2d7',
            }}>
              {/* QR pattern */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, width: 140, height: 140 }}>
                {Array.from({ length: 49 }).map((_, i) => {
                  const row = Math.floor(i / 7)
                  const col = i % 7
                  const isCorner = (row < 2 && col < 2) || (row < 2 && col > 4) || (row > 4 && col < 2)
                  const isCenter = row >= 2 && row <= 4 && col >= 2 && col <= 4
                  const fill = isCorner ? '#1d1d1f' : isCenter ? '#1D6AE5' : (row + col) % 3 === 0 ? '#1d1d1f' : '#d2d2d7'
                  return <div key={i} style={{ borderRadius: 2, background: fill, aspectRatio: '1' }} />
                })}
              </div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, fontWeight: 600, color: '#1d1d1f', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                TakeMe Hub
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ AMENITIES ════════════════════════════════════════════════════ */}
      <Section bg="#ffffff">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#86868b', marginBottom: 16 }}>
              Everything You Need
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: '#1d1d1f' }}>
              Built for the driver lifestyle.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {AMENITIES.map((a) => (
              <div key={a.title} style={{
                position: 'relative', borderRadius: 16, overflow: 'hidden',
                aspectRatio: '3/2', cursor: 'pointer',
                border: '1px solid #d2d2d7',
              }}>
                <img src={a.img} alt={a.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.6s ease' }} loading="lazy" />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.05) 50%)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  padding: 24, transition: 'background 0.3s',
                }}>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 600, margin: '0 0 6px', color: '#ffffff' }}>{a.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)', margin: 0 }}>{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ BEFORE / AFTER ══════════════════════════════════════════════ */}
      <Section bg="#f5f5f7">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: '#1d1d1f' }}>
              The difference is night and day.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }} className="dh-grid">
            {/* Before */}
            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 16, padding: 36 }}>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#dc2626', marginBottom: 24, marginTop: 0 }}>Without TakeMe Hub</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {BEFORE.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 14, color: '#dc2626', marginTop: 2, flexShrink: 0 }}>✕</span>
                    <span style={{ fontSize: 15, lineHeight: 1.5, color: '#6e6e73' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* After */}
            <div style={{ background: '#f0f5ff', border: '1px solid #bfdbfe', borderRadius: 16, padding: 36 }}>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1D6AE5', marginBottom: 24, marginTop: 0 }}>With TakeMe Hub</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {AFTER.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 14, color: '#1D6AE5', marginTop: 2, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 15, lineHeight: 1.5, color: '#1d1d1f' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ QUOTE ════════════════════════════════════════════════════════ */}
      <Section>
        <div style={{
          position: 'relative', padding: '160px 24px', overflow: 'hidden',
          backgroundImage: 'url(https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1800&q=80)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: 48, height: 2, background: '#c9a84c', margin: '0 auto 40px' }} />
            <blockquote style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 500,
              fontStyle: 'italic', lineHeight: 1.35,
              letterSpacing: '-0.02em', margin: 0, color: '#ffffff',
            }}>
              &ldquo;You are the face of TakeMe. The face deserves the best.&rdquo;
            </blockquote>
            <div style={{ width: 48, height: 2, background: '#c9a84c', margin: '40px auto 0' }} />
          </div>
        </div>
      </Section>

      {/* ═══ THREE FEATURE CARDS ══════════════════════════════════════════ */}
      <Section bg="#ffffff">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
            {[
              { title: 'Charging', desc: '100W USB-C ports at every seat. Wireless Qi pads on every table. Your device never dies here.', img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&q=80' },
              { title: 'Coffee', desc: 'Barista-quality espresso machine. Premium teas. Filtered water. Unlimited refills, always free.', img: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80' },
              { title: 'WiFi', desc: 'Enterprise-grade, uncapped WiFi. Stream in 4K, update your apps, video call — no throttling ever.', img: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&q=80' },
            ].map((card) => (
              <div key={card.title} style={{
                background: '#ffffff', border: '1px solid #d2d2d7',
                borderRadius: 16, overflow: 'hidden',
                transition: 'border-color 0.3s',
              }}>
                <div style={{ height: 200, overflow: 'hidden' }}>
                  <img src={card.img} alt={card.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                </div>
                <div style={{ padding: 28 }}>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, margin: '0 0 12px', color: '#1d1d1f' }}>{card.title}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.65, color: '#86868b', margin: 0 }}>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ JOIN ═════════════════════════════════════════════════════════ */}
      <Section bg="#f5f5f7">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="dh-grid">
          <div>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#86868b', marginBottom: 16 }}>
              Get Started
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.025em', margin: '0 0 24px', color: '#1d1d1f' }}>
              Join the Hub.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: '#6e6e73', margin: '0 0 36px', maxWidth: 420 }}>
              Every TakeMe driver gets free, unlimited access to the Driver Hub. No membership fees, no catches — just apply and drive.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link href="/driver/apply" style={{
                display: 'inline-flex', alignItems: 'center', height: 48,
                padding: '0 28px', borderRadius: 8, fontWeight: 600, fontSize: 15,
                background: '#1D6AE5', color: '#ffffff', textDecoration: 'none',
                transition: 'background 0.3s',
              }}>
                Apply to Drive
              </Link>
              <Link href="/driver" style={{
                display: 'inline-flex', alignItems: 'center', height: 48,
                padding: '0 28px', borderRadius: 8, fontWeight: 500, fontSize: 15,
                background: 'transparent', color: '#1d1d1f', textDecoration: 'none',
                border: '1px solid #d2d2d7',
                transition: 'border-color 0.3s',
              }}>
                Learn More
              </Link>
            </div>
          </div>

          {/* Steps card */}
          <div style={{
            background: '#ffffff', border: '1px solid #d2d2d7',
            borderRadius: 16, padding: 36,
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#86868b', marginBottom: 32, marginTop: 0 }}>4 Steps to Access</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {STEPS.map((step, i) => (
                <div key={step.num} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: i === 0 ? '#1D6AE5' : '#f5f5f7',
                    border: i === 0 ? 'none' : '1px solid #d2d2d7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 14, fontWeight: 700,
                    color: i === 0 ? '#ffffff' : '#86868b',
                  }}>
                    {step.num}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px', color: '#1d1d1f' }}>{step.title}</h4>
                    <p style={{ fontSize: 14, lineHeight: 1.5, color: '#86868b', margin: 0 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Footer rendered by root layout */}

      {/* ═══ RESPONSIVE ══════════════════════════════════════════════════ */}
      <style>{`
        @media (max-width: 768px) {
          .dh-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
