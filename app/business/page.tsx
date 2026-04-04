'use client'

import Link from 'next/link'
import { useRef, useState, useEffect, useCallback } from 'react'

/* ── Scroll reveal ─���─────────────────────────────────────────────────── */
function useReveal(threshold = 0.1) {
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

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal(0.1)
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

/* ─�� Data ─────────────────────────────────────────────────────────────── */

const STATS = [
  { num: '500', accent: '+', label: 'Corporate Accounts' },
  { num: '99', accent: '.9%', label: 'On-Time Rate' },
  { num: '15', accent: '%', label: 'Lower Cost vs Uber Business' },
  { num: '24', accent: '/7', label: 'Dedicated Support' },
]

const LOGOS = ['Microsoft', 'Amazon', 'T-Mobile', 'Salesforce', 'Adobe', 'Boeing', 'Starbucks', 'Marriott']

const WHY_CARDS = [
  { num: '01', icon: '💳', title: 'Centralized Billing', desc: 'One invoice, all employees. No expense reports, no reimbursements. Full cost visibility with department-level breakdown and custom spending limits.', stat: '→ Save 8hrs/month in finance ops' },
  { num: '02', icon: '📍', title: 'Real-Time Tracking', desc: 'See every ride, every driver, every ETA from a single dashboard. Know exactly where your team is — whether it\'s a client pickup or airport transfer.', stat: '→ 99.9% tracking accuracy' },
  { num: '03', icon: '🛡️', title: 'Enterprise Safety', desc: 'Background-checked drivers, real-time trip monitoring. Our safety engine processes 200+ data points per ride.', stat: '→ Zero safety incidents' },
  { num: '04', icon: '⚡', title: 'EV-First Fleet', desc: '100% electric vehicle priority. Meet your ESG commitments. Report Scope 3 emission reductions directly from your dashboard.', stat: '→ Carbon neutral rides' },
  { num: '05', icon: '🔗', title: 'SSO & HR Integration', desc: 'Connect with Workday, BambooHR, Okta, and Azure AD. Employees onboard in seconds. Auto-provision as your team changes.', stat: '→ 2-minute employee setup' },
  { num: '06', icon: '📊', title: 'Advanced Analytics', desc: 'Custom reports, spend forecasting, route optimization. Export to Excel, Tableau, or Power BI. Your data, your way.', stat: '→ Full API access' },
]

const FEATURES = [
  { icon: '🏢', cls: 'blue', title: 'Admin Dashboard', desc: 'Complete control over your company\'s mobility. Approve rides, set budgets, manage employees, and analyze spending.', badge: 'Web + Mobile' },
  { icon: '✈️', cls: 'gold', title: 'Airport & Hotel Transfers', desc: 'Pre-scheduled pickups synced with flight data. Drivers adjust in real-time for delays. VIP concierge for executives.', badge: 'Flight Tracking' },
  { icon: '🔒', cls: 'green', title: 'Custom Ride Policies', desc: 'Set rules by role, time, location, or purpose. Only allow rides to approved destinations. Automatic approval for commutes.', badge: 'Fully Configurable' },
  { icon: '📱', cls: 'blue', title: 'White-Label Option', desc: 'Deploy TakeMe under your own brand. Custom app icon, colors, and domain. Your employees, your brand experience.', badge: 'Enterprise Only' },
  { icon: '🌐', cls: 'gold', title: 'Multi-City Coverage', desc: 'As TakeMe expands nationally, your contract covers every city. One agreement, one invoice, one platform.', badge: 'Expanding Q3 2026' },
  { icon: '🤝', cls: 'green', title: 'Dedicated Account Manager', desc: 'Named account manager with direct Slack access, monthly reviews, and proactive optimization recommendations.', badge: '24/7 Support' },
]

const INDUSTRIES = [
  { icon: '🏢', tag: 'Tech & Software', name: 'Corporate Campuses', desc: 'Microsoft, Amazon, T-Mobile, Salesforce, Adobe — we move the people building the future.', note: '→ Commuter + client rides' },
  { icon: '🏨', tag: 'Hospitality', name: 'Hotels & Resorts', desc: 'Marriott, Hilton, Hyatt — seamless guest transfers with white-glove TakeMe service.', note: '→ Airport + event transfers' },
  { icon: '🏭', tag: 'Manufacturing', name: 'Industrial & Aerospace', desc: 'Boeing, PACCAR — shift workers and executive commutes handled with precision and reliability.', note: '→ Shift + executive rides' },
  { icon: '🏥', tag: 'Healthcare', name: 'Hospitals & Clinics', desc: 'Swedish, UW Medicine — staff transportation and patient transfer coordination at scale.', note: '→ Staff + patient transport' },
]

const PRICING = [
  {
    name: 'Starter', price: '12', unit: '% per ride', featured: false,
    desc: 'For teams up to 50 employees getting started with corporate mobility.',
    features: ['Centralized billing', 'Up to 50 employees', 'Basic admin dashboard', 'Email support', 'Monthly reporting'],
    cta: 'Get Started',
  },
  {
    name: 'Business', price: '10', unit: '% per ride', featured: true,
    desc: 'For growing companies that need full control and advanced features.',
    features: ['Everything in Starter', 'Unlimited employees', 'SSO + HR integration', 'Real-time tracking', 'Custom ride policies', 'Dedicated account manager', 'API access'],
    cta: 'Get Started',
  },
  {
    name: 'Enterprise', price: 'Custom', unit: '', featured: false,
    desc: 'For large organizations needing white-label, multi-city, and SLA guarantees.',
    features: ['Everything in Business', 'White-label option', 'Multi-city coverage', 'Custom SLA (99.9%)', 'Dedicated driver fleet', 'Executive concierge', 'On-site implementation'],
    cta: 'Contact Sales',
  },
]

/* ── Styles ───────────────────────────────────────────────────────────── */
const S = {
  bg: '#080810',
  bgAlt: '#050510',
  card: '#0d0d1a',
  cardHover: '#111128',
  blue: '#1D6AE5',
  blue2: '#1558C0',
  gold: '#C9A84C',
  white: '#ffffff',
  gray: '#8a8a9a',
  light: '#c8c8d8',
  border: '#1e1e2e',
  borderFaint: 'rgba(255,255,255,0.06)',
}

const font = "'Playfair Display', Georgia, serif"
const body = "'DM Sans', system-ui, sans-serif"

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function BusinessPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleDemo = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return
    setSubmitted(true)
  }, [email])

  return (
    <div style={{ background: S.bg, color: S.white, fontFamily: body, overflowX: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap" />

      {/* ═══ NAV ═════════════════════════════════════════════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
        padding: '0 clamp(24px, 5vw, 64px)', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(8,8,16,0.8)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${S.borderFaint}`,
      }}>
        <Link href="/" style={{ fontSize: 16, fontWeight: 600, color: S.white, textDecoration: 'none' }}>
          TakeMe <span style={{ color: S.blue }}>Business</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/" style={{ fontSize: 13, color: S.gray, textDecoration: 'none', transition: 'color .2s' }}>
            &larr; TakeMe
          </Link>
          <a href="#contact" style={{
            background: S.blue, color: S.white, border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            transition: 'background .15s', letterSpacing: '.3px',
          }}>
            Get a Demo
          </a>
        </div>
      </nav>

      {/* ═══ HERO ════════════════════════════════════════════════════════ */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '120px clamp(24px, 5vw, 64px) 80px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid bg */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(29,106,229,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(29,106,229,0.06) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)',
          animation: 'gridFloat 20s ease-in-out infinite',
        }} />
        {/* Orbs */}
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', filter: 'blur(120px)', background: 'rgba(29,106,229,0.12)', top: -100, right: -100, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', filter: 'blur(120px)', background: 'rgba(201,168,76,0.06)', bottom: 0, left: 200, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(29,106,229,0.1)', border: '1px solid rgba(29,106,229,0.25)',
            borderRadius: 100, padding: '8px 18px', fontSize: 12, fontWeight: 600,
            letterSpacing: 2, textTransform: 'uppercase', color: S.blue, marginBottom: 40,
            opacity: 0, animation: 'fadeUp .6s .1s forwards',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: S.blue, animation: 'pulse 2s infinite' }} />
            Enterprise Mobility Platform
          </div>

          <h1 style={{
            fontFamily: font, fontSize: 'clamp(48px, 7vw, 110px)', fontWeight: 900,
            lineHeight: 0.95, letterSpacing: '-4px', margin: '0 0 40px', maxWidth: 900,
            opacity: 0, animation: 'fadeUp .8s .3s forwards',
          }}>
            Move your<br /><span style={{ color: S.blue }}>team.</span><br />
            Grow your<br /><span style={{ color: S.gold }}>business.</span>
          </h1>

          <p style={{
            fontSize: 20, fontWeight: 300, color: S.light, lineHeight: 1.7,
            maxWidth: 560, marginBottom: 56,
            opacity: 0, animation: 'fadeUp .8s .5s forwards',
          }}>
            The mobility platform trusted by Seattle&apos;s most innovative companies. Centralized billing, real-time tracking, and white-glove service — at scale.
          </p>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            opacity: 0, animation: 'fadeUp .8s .7s forwards',
          }}>
            <a href="#contact" style={{
              background: S.blue, color: S.white, border: 'none', borderRadius: 8,
              padding: '18px 40px', fontSize: 16, fontWeight: 600, textDecoration: 'none',
              transition: 'all .2s', display: 'inline-flex', alignItems: 'center', gap: 10,
            }}>
              Schedule a Demo <span>&rarr;</span>
            </a>
            <a href="#pricing" style={{
              background: 'transparent', color: S.white, borderRadius: 8,
              padding: '18px 40px', fontSize: 16, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.15)', transition: 'all .2s',
            }}>
              View Pricing
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
          borderTop: `1px solid ${S.borderFaint}`,
          background: 'rgba(8,8,16,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          opacity: 0, animation: 'fadeUp .8s .9s forwards',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {STATS.map((s, i) => (
              <div key={i} style={{
                textAlign: 'center', padding: '24px 16px',
                borderLeft: i > 0 ? `1px solid ${S.borderFaint}` : 'none',
              }}>
                <div style={{ fontFamily: font, fontSize: 40, fontWeight: 700, letterSpacing: '-1.5px' }}>
                  {s.num}<span style={{ color: S.blue }}>{s.accent}</span>
                </div>
                <div style={{ fontSize: 12, color: S.gray, marginTop: 4, letterSpacing: '.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LOGOS ════════════════════════════════════════════════════════ */}
      <Reveal>
        <div style={{ padding: '80px clamp(24px, 5vw, 64px)', borderTop: `1px solid ${S.borderFaint}`, borderBottom: `1px solid ${S.borderFaint}` }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: S.gray, textAlign: 'center', marginBottom: 48 }}>
            Trusted by Seattle&apos;s leading organizations
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(32px, 5vw, 64px)', flexWrap: 'wrap' }}>
            {LOGOS.map(l => (
              <span key={l} style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '-.5px', transition: 'color .3s', cursor: 'default', whiteSpace: 'nowrap' }}>{l}</span>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ═══ WHY TAKEME BUSINESS ══════════════════════════════════════════ */}
      <section style={{ padding: '120px clamp(24px, 5vw, 64px)', maxWidth: 1400, margin: '0 auto' }}>
        <Reveal>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: S.blue, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 24, height: 1, background: S.blue }} />Why TakeMe Business
          </div>
        </Reveal>
        <Reveal>
          <h2 style={{ fontFamily: font, fontSize: 'clamp(40px, 4.5vw, 68px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-2.5px', marginBottom: 80, maxWidth: 700 }}>
            Your employees deserve<br />rides that <em style={{ fontStyle: 'normal', color: S.gold }}>work.</em>
          </h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 2, borderRadius: 20, overflow: 'hidden' }}>
          {WHY_CARDS.map((c, i) => (
            <Reveal key={c.num} delay={i % 3 * 0.1}>
              <div style={{
                background: S.card, padding: '48px 40px', border: `1px solid ${S.border}`,
                transition: 'background .3s', minHeight: 320,
              }}>
                <div style={{ fontFamily: font, fontSize: 72, fontWeight: 900, color: 'rgba(29,106,229,0.08)', letterSpacing: '-3px', lineHeight: 1, marginBottom: -20 }}>{c.num}</div>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(29,106,229,0.1)', border: '1px solid rgba(29,106,229,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 24 }}>{c.icon}</div>
                <div style={{ fontFamily: font, fontSize: 26, fontWeight: 700, letterSpacing: '-.8px', marginBottom: 14 }}>{c.title}</div>
                <p style={{ fontSize: 15, color: S.gray, lineHeight: 1.7, margin: 0 }}>{c.desc}</p>
                <div style={{ marginTop: 28, paddingTop: 28, borderTop: `1px solid ${S.borderFaint}`, fontSize: 13, color: S.blue, fontWeight: 600, letterSpacing: '.3px' }}>{c.stat}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═════════════════════════════════════════════════════ */}
      <section style={{ background: S.bgAlt, borderTop: `1px solid ${S.borderFaint}`, borderBottom: `1px solid ${S.borderFaint}`, padding: '120px clamp(24px, 5vw, 64px)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: 80 }}>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: S.blue, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 24, height: 1, background: S.blue }} />Platform Features
              </div>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(40px, 4.5vw, 68px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-2.5px', maxWidth: 700 }}>
                Built for <em style={{ fontStyle: 'normal', color: S.blue }}>enterprise.</em><br />Designed for humans.
              </h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 24 }}>
            {FEATURES.map((f, i) => {
              const iconBg = f.cls === 'blue' ? 'rgba(29,106,229,0.12)' : f.cls === 'gold' ? 'rgba(201,168,76,0.1)' : 'rgba(52,199,89,0.1)'
              const iconBorder = f.cls === 'blue' ? 'rgba(29,106,229,0.2)' : f.cls === 'gold' ? 'rgba(201,168,76,0.15)' : 'rgba(52,199,89,0.15)'
              return (
                <Reveal key={f.title} delay={i % 2 * 0.1}>
                  <div style={{
                    background: '#0a0a18', border: `1px solid ${S.borderFaint}`, borderRadius: 20, padding: 40,
                    display: 'flex', gap: 28, alignItems: 'flex-start', transition: 'border-color .25s, transform .25s',
                    minHeight: 180,
                  }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, background: iconBg, border: `1px solid ${iconBorder}` }}>{f.icon}</div>
                    <div>
                      <h4 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, letterSpacing: '-.3px', marginTop: 0 }}>{f.title}</h4>
                      <p style={{ fontSize: 14, color: S.gray, lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
                      <span style={{ display: 'inline-block', marginTop: 12, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: S.blue, background: 'rgba(29,106,229,0.1)', border: '1px solid rgba(29,106,229,0.2)', padding: '4px 10px', borderRadius: 6 }}>{f.badge}</span>
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ INDUSTRIES ═══════════════════════════════════════════════════ */}
      <section style={{ padding: '120px clamp(24px, 5vw, 64px)', maxWidth: 1400, margin: '0 auto' }}>
        <Reveal>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: S.blue, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 24, height: 1, background: S.blue }} />Industries We Serve
          </div>
          <h2 style={{ fontFamily: font, fontSize: 'clamp(40px, 4.5vw, 68px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-2.5px', marginBottom: 64 }}>
            Every industry.<br />Every need.
          </h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {INDUSTRIES.map((ind, i) => (
            <Reveal key={ind.name} delay={i * 0.1}>
              <div style={{
                background: S.card, border: `1px solid ${S.borderFaint}`, borderRadius: 20, overflow: 'hidden',
                transition: 'transform .3s, border-color .3s', cursor: 'pointer',
              }}>
                <div style={{
                  height: 180, background: 'linear-gradient(135deg, #111128, #0a0a20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, position: 'relative',
                }}>
                  {ind.icon}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(13,13,26,1))' }} />
                </div>
                <div style={{ padding: 24 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: S.blue, marginBottom: 8, fontWeight: 600 }}>{ind.tag}</div>
                  <div style={{ fontFamily: font, fontSize: 20, fontWeight: 700, letterSpacing: '-.5px', marginBottom: 8 }}>{ind.name}</div>
                  <p style={{ fontSize: 13, color: S.gray, lineHeight: 1.55, margin: 0 }}>{ind.desc}</p>
                  <div style={{ marginTop: 16, fontSize: 12, color: S.blue, fontWeight: 600 }}>{ind.note}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ PRICING ══════════════════════════════════════════════════════ */}
      <section id="pricing" style={{ background: S.bgAlt, borderTop: `1px solid ${S.borderFaint}`, padding: '120px clamp(24px, 5vw, 64px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: S.blue, fontWeight: 600, marginBottom: 20 }}>Pricing</div>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(40px, 4.5vw, 68px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-2.5px', margin: 0 }}>Simple, transparent pricing.</h2>
              <p style={{ fontSize: 18, color: S.gray, marginTop: 16 }}>No hidden fees. No per-seat licenses. Pay only for rides taken.</p>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {PRICING.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div style={{
                  border: `1px solid ${plan.featured ? 'rgba(29,106,229,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 24, padding: 40, position: 'relative', overflow: 'hidden',
                  background: plan.featured ? 'linear-gradient(135deg, #0d1a3a, #0a1228)' : '#0a0a18',
                  boxShadow: plan.featured ? '0 0 80px rgba(29,106,229,0.08)' : 'none',
                  transition: 'transform .3s', minHeight: 520,
                  display: 'flex', flexDirection: 'column',
                }}>
                  {plan.featured && (
                    <div style={{ position: 'absolute', top: 24, right: 24, background: S.blue, color: S.white, fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 100 }}>Most Popular</div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: S.gray, marginBottom: 16 }}>{plan.name}</div>
                  <div style={{ fontFamily: font, fontSize: plan.price === 'Custom' ? 36 : 56, fontWeight: 700, letterSpacing: '-2px', lineHeight: 1, marginBottom: 6 }}>
                    {plan.price}<small style={{ fontSize: 18, fontWeight: 400, color: S.gray }}>{plan.unit}</small>
                  </div>
                  <p style={{ fontSize: 13, color: S.gray, marginBottom: 32, lineHeight: 1.5 }}>{plan.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36, flex: 1 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ fontSize: 14, color: S.light, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ color: plan.featured ? '#34c759' : S.blue, fontWeight: 700, fontSize: 13, marginTop: 1, flexShrink: 0 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button style={{
                    width: '100%', padding: 15, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    border: plan.featured ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    background: plan.featured ? S.blue : 'transparent',
                    color: S.white, transition: 'all .2s', fontFamily: body,
                  }}>
                    {plan.cta}
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIAL ══════════════════════════════════════════════════ */}
      <Reveal>
        <div style={{ padding: '120px clamp(24px, 5vw, 64px)', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: font, fontSize: 'clamp(24px, 3.5vw, 48px)', fontWeight: 400, fontStyle: 'italic', lineHeight: 1.3, letterSpacing: '-.5px', marginBottom: 40 }}>
            &ldquo;TakeMe Business cut our employee transportation costs by <em style={{ fontStyle: 'normal', color: S.gold }}>23%</em> in the first quarter. The admin dashboard alone saves our team hours every week.&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: `linear-gradient(135deg, ${S.blue}, #4d9fff)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, fontFamily: font }}>S</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Sarah K.</div>
              <div style={{ fontSize: 13, color: S.gray }}>Head of Operations, Fortune 500 Tech Company</div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ═══ CTA ══════════════════════════════════════════════════════════ */}
      <Reveal>
        <div id="contact" style={{
          margin: '0 clamp(24px, 5vw, 64px) 120px',
          background: 'linear-gradient(135deg, #0d1a3a 0%, #0a1228 50%, #0d1a3a 100%)',
          border: '1px solid rgba(29,106,229,0.25)', borderRadius: 32,
          padding: '100px clamp(24px, 5vw, 80px)', textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(29,106,229,0.08), transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 5 }}>
            <h2 style={{ fontFamily: font, fontSize: 'clamp(40px, 5vw, 72px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-3px', marginBottom: 20 }}>
              Ready to move<br /><span style={{ color: S.blue }}>smarter?</span>
            </h2>
            <p style={{ fontSize: 20, color: S.light, marginBottom: 48, lineHeight: 1.6 }}>
              Join 500+ companies already using TakeMe Business.<br />Setup takes less than 24 hours.
            </p>
            {submitted ? (
              <div style={{ fontSize: 18, fontWeight: 600, color: S.blue }}>
                Thank you! We&apos;ll reach out within 2 hours.
              </div>
            ) : (
              <form onSubmit={handleDemo} style={{ display: 'flex', gap: 12, maxWidth: 500, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
                <input
                  type="email" placeholder="Your work email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    flex: '1 1 280px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, padding: '16px 20px', fontSize: 15, color: S.white,
                    outline: 'none', fontFamily: body,
                  }}
                />
                <button type="submit" style={{
                  background: S.blue, color: S.white, border: 'none', borderRadius: 10,
                  padding: '16px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  whiteSpace: 'nowrap', fontFamily: body, transition: 'background .15s',
                }}>
                  Get a Demo &rarr;
                </button>
              </form>
            )}
            <p style={{ fontSize: 13, color: S.gray, marginTop: 16 }}>No commitment required &middot; Response within 2 hours &middot; Free onboarding</p>
          </div>
        </div>
      </Reveal>

      {/* ═══ FOOTER ══════════════════════════════════════════════════════ */}
      <footer style={{
        borderTop: `1px solid ${S.borderFaint}`, padding: '48px clamp(24px, 5vw, 64px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24,
      }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>TakeMe <span style={{ color: S.blue }}>Business</span></div>
        <div style={{ fontSize: 13, color: S.gray }}>&copy; {new Date().getFullYear()} TakeMe Mobility LLC &middot; Seattle, WA</div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Home', 'Safety', 'Privacy'].map(l => (
            <Link key={l} href={l === 'Home' ? '/' : `/${l.toLowerCase()}`} style={{ fontSize: 13, color: S.gray, textDecoration: 'none', transition: 'color .15s' }}>{l}</Link>
          ))}
        </div>
      </footer>

      {/* ═══ ANIMATIONS ══════════════════════════════════════════════════ */}
      <style>{`
        @keyframes gridFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.3; } }
        @media (max-width: 768px) {
          section > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
