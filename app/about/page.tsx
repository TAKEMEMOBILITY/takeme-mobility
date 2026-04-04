import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#d2d2d7]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] text-[#1d1d1f]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#86868b]">About</span>
          </Link>
          <Link href="/" className="text-[14px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">Back to home</Link>
        </div>
      </header>
      <div className="mx-auto max-w-[800px] px-6 py-20 lg:px-10">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-[#1d1d1f]">About TakeMe Mobility</h1>
        <p className="mt-6 text-[17px] leading-[1.7] text-[#6e6e73]">
          TakeMe Mobility is Seattle&apos;s premium all-electric rideshare platform. We are building a transportation network that prioritizes safety, reliability, and sustainability.
        </p>
        <p className="mt-4 text-[17px] leading-[1.7] text-[#6e6e73]">
          Founded in 2026, TakeMe operates an EV-first fleet across the Seattle metro area, with plans to expand nationally. Our platform serves riders, drivers, fleet owners, and enterprise clients.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { value: '100%', label: 'Electric fleet' },
            { value: 'Seattle', label: 'Headquarters' },
            { value: '24/7', label: 'Support' },
            { value: '2026', label: 'Founded' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-[#f5f5f7] p-5 text-center">
              <div className="text-[24px] font-bold text-[#1d1d1f]">{s.value}</div>
              <div className="mt-1 text-[13px] text-[#86868b]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
