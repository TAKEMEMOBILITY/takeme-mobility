'use client'
import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Shield, Car, DollarSign, Check, ChevronRight, ChevronLeft, Upload, Loader2, Zap, Camera } from 'lucide-react'

const STEP_LABELS = ['About You', 'Verify Identity', 'Your Vehicle', 'Set Pricing']
const STEP_ICONS = [User, Shield, Car, DollarSign]

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
}

export default function ListYourEvPage() {
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  // Step 1
  const [fullName, setFullName] = useState('')
  const [businessType, setBusinessType] = useState<'Individual' | 'LLC' | 'Corporation'>('Individual')
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Step 2
  const [kycSubmitted, setKycSubmitted] = useState(false)

  // Step 3
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [vin, setVin] = useState('')
  const [color, setColor] = useState('')
  const [vehicleType, setVehicleType] = useState('Sedan')
  const [range, setRange] = useState('')
  const [batteryCapacity, setBatteryCapacity] = useState('')
  const [connectorType, setConnectorType] = useState('CCS1')
  const [pickupAddress, setPickupAddress] = useState('')
  const [city, setCity] = useState('Seattle')
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([])

  // Step 4
  const [dailyRate, setDailyRate] = useState(85)
  const [weeklyOverride, setWeeklyOverride] = useState<string>('')
  const [securityDeposit, setSecurityDeposit] = useState(500)
  const [cleaningFee, setCleaningFee] = useState(50)
  const [mileageLimit, setMileageLimit] = useState('Unlimited')

  const weeklyRate = weeklyOverride !== '' ? Number(weeklyOverride) : Math.round(dailyRate * 6.5)
  const estimatedMonthly = Math.round(dailyRate * 25 * 0.8)

  const goForward = useCallback(() => { setDirection(1); setStep(s => s + 1); setError(null) }, [])
  const goBack = useCallback(() => { setDirection(-1); setStep(s => s - 1); setError(null) }, [])

  // Check for KYC return param on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('kyc')) {
      setKycSubmitted(true)
    }
  }, [])

  const handleStep1Submit = async () => {
    if (!fullName.trim()) { setError('Full name is required.'); return }
    if (!termsAccepted) { setError('You must accept the terms of service.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/fleet/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, businessType, businessName: businessType !== 'Individual' ? businessName : undefined, phone }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create owner profile.') }
      const data = await res.json()
      setOwnerId(data.id || data.data?.id || data.ownerId)
      goForward()
    } catch (err: any) { setError(err.message || 'Something went wrong.') }
    finally { setLoading(false) }
  }

  const handleStartKyc = async () => {
    if (!ownerId) { setError('Complete Step 1 first.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/fleet/owners/${ownerId}/kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to start verification.') }
      const data = await res.json()
      if (data.data?.url) {
        window.location.href = data.data.url
      }
    } catch (err: any) { setError(err.message || 'Something went wrong.') }
    finally { setLoading(false) }
  }

  const handleStep3Submit = async () => {
    if (!make.trim() || !model.trim() || !year || !vin.trim()) { setError('Make, model, year, and VIN are required.'); return }
    if (vin.length !== 17) { setError('VIN must be exactly 17 characters.'); return }
    if (Number(year) < 2015) { setError('Year must be 2015 or later.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/fleet/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId, make, model, year: Number(year), vin, color, vehicleType,
          range: range ? Number(range) : undefined,
          batteryCapacity: batteryCapacity ? Number(batteryCapacity) : undefined,
          connectorType, pickupAddress, city,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to add vehicle.') }
      const data = await res.json()
      setVehicleId(data.id || data.data?.id || data.vehicleId)
      goForward()
    } catch (err: any) { setError(err.message || 'Something went wrong.') }
    finally { setLoading(false) }
  }

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !vehicleId) return
    setLoading(true); setError(null)
    try {
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData()
        fd.append('photo', files[i])
        const res = await fetch(`/api/fleet/vehicles/${vehicleId}/photos`, { method: 'POST', body: fd })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to upload photo.') }
        const data = await res.json()
        setPhotos(prev => [...prev, { id: data.id || data.data?.id || String(Date.now()), url: data.url || data.data?.url || URL.createObjectURL(files[i]) }])
      }
    } catch (err: any) { setError(err.message || 'Upload failed.') }
    finally { setLoading(false) }
  }

  const handleDeletePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  const handleStep4Submit = async () => {
    if (!vehicleId) { setError('Complete Step 3 first.'); return }
    setLoading(true); setError(null)
    try {
      const res1 = await fetch(`/api/fleet/vehicles/${vehicleId}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyRate, weeklyRate, securityDeposit, cleaningFee, mileageLimit }),
      })
      if (!res1.ok) { const d = await res1.json(); throw new Error(d.error || 'Failed to set pricing.') }

      const res2 = await fetch(`/api/fleet/vehicles/${vehicleId}/submit`, { method: 'POST' })
      if (!res2.ok) { const d = await res2.json(); throw new Error(d.error || 'Failed to submit for review.') }

      setCompleted(true)
    } catch (err: any) { setError(err.message || 'Something went wrong.') }
    finally { setLoading(false) }
  }

  if (completed) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              width: 96, height: 96, borderRadius: '50%', background: '#e8fae8',
              border: '2px solid #248a24',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px',
            }}
          >
            <Check size={48} color="#248a24" strokeWidth={3} />
          </motion.div>
          <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '2rem', color: '#1d1d1f', marginBottom: 12 }}>
            Your EV is under review!
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: '#6e6e73', marginBottom: 40 }}>
            We'll notify you once approved. Usually within 24 hours.
          </p>
          <a
            href="/fleet/dashboard/owner"
            className="fleet-btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px',
              background: '#1D6AE5', color: '#FFFFFF', borderRadius: 12,
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '1rem',
              textDecoration: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            Go to Dashboard <ChevronRight size={18} />
          </a>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: "'DM Sans', sans-serif", color: '#1d1d1f' }}>
      {/* Progress Bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: '#FFFFFF', borderBottom: '1px solid #d2d2d7', paddingTop: 96 }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1
              const isCompleted = step > stepNum
              const isActive = step === stepNum
              const Icon = STEP_ICONS[i]
              return (
                <React.Fragment key={label}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.3s',
                      ...(isCompleted
                        ? { background: '#005bb5', color: '#FFFFFF' }
                        : isActive
                          ? { background: '#f0f5ff', border: '2px solid #bfdbfe', color: '#005bb5' }
                          : { background: '#f5f5f7', border: '1px solid #d2d2d7', color: '#86868b' }),
                    }}>
                      {isCompleted ? <Check size={16} strokeWidth={3} /> : stepNum}
                    </div>
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', marginTop: 6,
                      color: isActive ? '#005bb5' : '#6e6e73',
                      whiteSpace: 'nowrap',
                    }}>
                      {label}
                    </span>
                  </div>
                  {i < 3 && (
                    <div style={{
                      flex: 1, height: 2, margin: '0 8px', marginBottom: 22,
                      background: step > stepNum ? '#005bb5' : '#d2d2d7',
                      borderRadius: 1, minWidth: 24,
                    }} />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingTop: 220, paddingBottom: 120, maxWidth: 640, margin: '0 auto', padding: '220px 24px 120px' }}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#f0f5ff', border: '1px solid #bfdbfe',
              borderRadius: 12, padding: '12px 16px', marginBottom: 24,
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem', color: '#005bb5',
            }}
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          {/* ======================== STEP 1 ======================== */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '2rem', color: '#1d1d1f', marginBottom: 8 }}>
                Tell us about yourself
              </h2>
              <p style={{ color: '#6e6e73', fontSize: '1rem', marginBottom: 32 }}>
                We need a few details to get started
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Full Name *</label>
                  <input
                    className="fleet-input"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe"
                    style={{
                      width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7',
                      borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Business Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {(['Individual', 'LLC', 'Corporation'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        className="fleet-card"
                        onClick={() => setBusinessType(type)}
                        style={{
                          height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: businessType === type ? '#f0f5ff' : '#FFFFFF',
                          border: businessType === type ? '2px solid #005bb5' : '1px solid #d2d2d7',
                          borderRadius: 12, color: businessType === type ? '#005bb5' : '#6e6e73',
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: '0.9rem',
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {businessType !== 'Individual' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Business Name</label>
                    <input
                      className="fleet-input"
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      placeholder="Your business name"
                      style={{
                        width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7',
                        borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    />
                  </motion.div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Phone (optional)</label>
                  <input
                    className="fleet-input"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    style={{
                      width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7',
                      borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginTop: 8 }}>
                  <div
                    onClick={() => setTermsAccepted(!termsAccepted)}
                    style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: termsAccepted ? '#005bb5' : 'transparent',
                      border: termsAccepted ? '2px solid #005bb5' : '2px solid #d2d2d7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s', cursor: 'pointer',
                    }}
                  >
                    {termsAccepted && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: '0.875rem', color: '#6e6e73' }}>
                    I agree to the <span style={{ color: '#005bb5', textDecoration: 'underline', cursor: 'pointer' }}>TakeMe Fleet Terms of Service</span>
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 40 }}>
                <button
                  className="fleet-btn-primary"
                  onClick={handleStep1Submit}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px',
                    background: '#1D6AE5', color: '#FFFFFF', borderRadius: 12,
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '0.95rem',
                    border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  Continue <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ======================== STEP 2 ======================== */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '2rem', color: '#1d1d1f', marginBottom: 8 }}>
                Verify your identity
              </h2>
              <p style={{ color: '#6e6e73', fontSize: '1rem', marginBottom: 40 }}>
                Quick KYC verification powered by Stripe
              </p>

              {!ownerId ? (
                <div className="fleet-card" style={{
                  background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 16,
                  padding: '48px 32px', textAlign: 'center',
                }}>
                  <p style={{ color: '#005bb5', fontSize: '0.95rem' }}>Complete Step 1 first</p>
                </div>
              ) : kycSubmitted ? (
                <div className="fleet-card" style={{
                  background: '#e8fae8', border: '1px solid #248a24', borderRadius: 16,
                  padding: '48px 32px', textAlign: 'center',
                }}>
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    style={{
                      width: 64, height: 64, borderRadius: '50%', background: '#e8fae8',
                      border: '2px solid #248a24',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                    }}
                  >
                    <Check size={32} color="#248a24" strokeWidth={3} />
                  </motion.div>
                  <h3 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.25rem', color: '#248a24', marginBottom: 8 }}>
                    Verification submitted
                  </h3>
                  <p style={{ color: '#6e6e73', fontSize: '0.875rem' }}>
                    Your identity verification is being processed.
                  </p>
                </div>
              ) : (
                <div className="fleet-card" style={{
                  background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 16,
                  padding: '48px 32px', textAlign: 'center',
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%', background: '#f0f5ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                  }}>
                    <Shield size={32} color="#005bb5" />
                  </div>
                  <p style={{ color: '#6e6e73', fontSize: '0.95rem', maxWidth: 380, margin: '0 auto 32px', lineHeight: 1.6 }}>
                    We'll verify your identity through Stripe. You'll need a government-issued ID and a selfie.
                  </p>
                  <button
                    className="fleet-btn-primary"
                    onClick={handleStartKyc}
                    disabled={loading}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px',
                      background: '#1D6AE5', color: '#FFFFFF', borderRadius: 12,
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '1rem',
                      border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={18} />}
                    Start Verification
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40 }}>
                <button
                  className="fleet-btn-ghost"
                  onClick={goBack}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px',
                    background: 'transparent', border: '1px solid #d2d2d7', borderRadius: 12,
                    color: '#1d1d1f', fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                    fontSize: '0.95rem', cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={18} /> Back
                </button>
                {kycSubmitted && (
                  <button
                    className="fleet-btn-primary"
                    onClick={goForward}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px',
                      background: '#1D6AE5', color: '#FFFFFF', borderRadius: 12,
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '0.95rem',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    Continue <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ======================== STEP 3 ======================== */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '2rem', color: '#1d1d1f', marginBottom: 8 }}>
                Add your vehicle
              </h2>
              <p style={{ color: '#6e6e73', fontSize: '1rem', marginBottom: 32 }}>
                Tell us about your electric vehicle
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Make *</label>
                  <input className="fleet-input" value={make} onChange={e => setMake(e.target.value)} placeholder="Tesla"
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Model *</label>
                  <input className="fleet-input" value={model} onChange={e => setModel(e.target.value)} placeholder="Model 3"
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Year *</label>
                  <input className="fleet-input" type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="2023" min={2015}
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>VIN * (17 chars)</label>
                  <input className="fleet-input" value={vin} onChange={e => setVin(e.target.value.toUpperCase())} placeholder="5YJ3E1EA8KF000001" maxLength={17}
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.05em' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Color</label>
                  <input className="fleet-input" value={color} onChange={e => setColor(e.target.value)} placeholder="White"
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Vehicle Type</label>
                  <select className="fleet-select" value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif", appearance: 'none' }}>
                    {['Sedan', 'SUV', 'Hatchback', 'Truck', 'Van', 'Luxury'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Range (miles)</label>
                  <input className="fleet-input" type="number" value={range} onChange={e => setRange(e.target.value)} placeholder="310"
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Battery Capacity (kWh)</label>
                  <input className="fleet-input" type="number" value={batteryCapacity} onChange={e => setBatteryCapacity(e.target.value)} placeholder="75"
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Connector Type</label>
                  <select className="fleet-select" value={connectorType} onChange={e => setConnectorType(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif", appearance: 'none' }}>
                    {['CCS1', 'CCS2', 'CHAdeMO', 'Tesla NACS', 'J1772', 'Type 2'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>Pickup Address</label>
                  <input className="fleet-input" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="123 Main St"
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 8 }}>City</label>
                  <input className="fleet-input" value={city} onChange={e => setCity(e.target.value)} placeholder="Seattle"
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                </div>
              </div>

              {/* Photo Upload */}
              {vehicleId && (
                <div style={{ marginTop: 32 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 12 }}>Photos</label>
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handlePhotoUpload(e.dataTransfer.files) }}
                    onClick={() => document.getElementById('photo-input')?.click()}
                    style={{
                      border: '2px dashed #d2d2d7', borderRadius: 16, padding: 48,
                      textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#bfdbfe')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#d2d2d7')}
                  >
                    <Camera size={32} color="#86868b" style={{ margin: '0 auto 12px' }} />
                    <p style={{ color: '#6e6e73', fontSize: '0.95rem' }}>Drop photos here or click to upload</p>
                    <input
                      id="photo-input"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={e => handlePhotoUpload(e.target.files)}
                      style={{ display: 'none' }}
                    />
                  </div>
                  {photos.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                      {photos.map(p => (
                        <div key={p.id} style={{ position: 'relative', width: 80, height: 80 }}>
                          <img src={p.url} alt="Vehicle" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid #d2d2d7' }} />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p.id) }}
                            style={{
                              position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                              borderRadius: '50%', background: '#FFFFFF', color: '#005bb5', border: '1px solid #d2d2d7',
                              fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              lineHeight: 1,
                            }}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40 }}>
                <button className="fleet-btn-ghost" onClick={goBack}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', background: 'transparent', border: '1px solid #d2d2d7', borderRadius: 12, color: '#1d1d1f', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: '0.95rem', cursor: 'pointer' }}>
                  <ChevronLeft size={18} /> Back
                </button>
                <button className="fleet-btn-primary" onClick={handleStep3Submit} disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: '#1D6AE5', color: '#FFFFFF', borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '0.95rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  Continue <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ======================== STEP 4 ======================== */}
          {step === 4 && (
            <motion.div
              key="step4"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '2rem', color: '#1d1d1f', marginBottom: 8 }}>
                Set your pricing
              </h2>
              <p style={{ color: '#6e6e73', fontSize: '1rem', marginBottom: 32 }}>
                You earn 80% of every rental. TakeMe takes 20% platform fee.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {/* Daily Rate */}
                <div className="fleet-card" style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', borderRadius: 16, padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73' }}>Daily Rate</span>
                    <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.75rem', color: '#005bb5' }}>${dailyRate}</span>
                  </div>
                  <input
                    type="range" min={30} max={300} value={dailyRate} onChange={e => setDailyRate(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#1D6AE5', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.75rem', color: '#86868b' }}>
                    <span>$30</span><span>$300</span>
                  </div>
                </div>

                {/* Weekly Rate */}
                <div className="fleet-card" style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', borderRadius: 16, padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73' }}>Weekly Rate</span>
                    <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.25rem', color: '#1d1d1f' }}>${weeklyRate}</span>
                  </div>
                  <input
                    className="fleet-input"
                    type="number"
                    value={weeklyOverride}
                    onChange={e => setWeeklyOverride(e.target.value)}
                    placeholder={`Auto: $${Math.round(dailyRate * 6.5)} (daily x 6.5)`}
                    style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.875rem', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                  />
                </div>

                {/* Security Deposit */}
                <div className="fleet-card" style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', borderRadius: 16, padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73' }}>Security Deposit</span>
                    <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.25rem', color: '#1d1d1f' }}>${securityDeposit}</span>
                  </div>
                  <input
                    type="range" min={200} max={1000} step={50} value={securityDeposit} onChange={e => setSecurityDeposit(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#1D6AE5', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.75rem', color: '#86868b' }}>
                    <span>$200</span><span>$1,000</span>
                  </div>
                </div>

                {/* Cleaning Fee */}
                <div className="fleet-card" style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', borderRadius: 16, padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73' }}>Cleaning Fee</span>
                    <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.25rem', color: '#1d1d1f' }}>${cleaningFee}</span>
                  </div>
                  <input
                    type="range" min={0} max={200} step={10} value={cleaningFee} onChange={e => setCleaningFee(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#1D6AE5', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.75rem', color: '#86868b' }}>
                    <span>$0</span><span>$200</span>
                  </div>
                </div>

                {/* Mileage Limit */}
                <div className="fleet-card" style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', borderRadius: 16, padding: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#6e6e73', marginBottom: 12 }}>Mileage Limit</label>
                  <select className="fleet-select" value={mileageLimit} onChange={e => setMileageLimit(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif", appearance: 'none' }}>
                    {['Unlimited', '100mi/day', '150mi/day', '200mi/day'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Earnings Preview */}
                <div className="fleet-card" style={{
                  background: '#FFFFFF', border: '1px solid #d2d2d7', borderRadius: 16, padding: '32px 24px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.875rem', color: '#6e6e73', marginBottom: 8 }}>Your estimated monthly earnings</p>
                  <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '3rem', color: '#005bb5', lineHeight: 1 }}>
                    ${estimatedMonthly.toLocaleString()}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#86868b', marginTop: 8 }}>Based on 25 rental days/month</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40 }}>
                <button className="fleet-btn-ghost" onClick={goBack}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', background: 'transparent', border: '1px solid #d2d2d7', borderRadius: 12, color: '#1d1d1f', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: '0.95rem', cursor: 'pointer' }}>
                  <ChevronLeft size={18} /> Back
                </button>
                <button className="fleet-btn-primary" onClick={handleStep4Submit} disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: '#1D6AE5', color: '#FFFFFF', borderRadius: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '1rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={18} />}
                  Submit for Review
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #1D6AE5;
          cursor: pointer;
          border: 2px solid #FFFFFF;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 2px;
          background: #d2d2d7;
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        select option {
          background: #FFFFFF;
          color: #1d1d1f;
        }
        .fleet-input:focus {
          border-color: #005bb5 !important;
        }
        @media (max-width: 640px) {
          .step-label-hide {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}