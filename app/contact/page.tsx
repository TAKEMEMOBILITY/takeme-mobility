import Link from 'next/link'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#d2d2d7]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] text-[#1d1d1f]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#86868b]">Contact</span>
          </Link>
          <Link href="/" className="text-[14px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">Back to home</Link>
        </div>
      </header>
      <div className="mx-auto max-w-[800px] px-6 py-20 lg:px-10">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-[#1d1d1f]">Contact Us</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[#6e6e73]">
          We would love to hear from you. Reach out through any of the channels below.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[
            { title: 'General Inquiries', detail: 'info@takememobility.com', sub: 'For partnerships, press, and general questions' },
            { title: 'Rider Support', detail: 'support@takememobility.com', sub: 'Help with rides, payments, and account issues' },
            { title: 'Driver Support', detail: 'drivers@takememobility.com', sub: 'Driver applications, payouts, and hub access' },
            { title: 'Business & Enterprise', detail: 'business@takememobility.com', sub: 'Corporate accounts and enterprise mobility' },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-[#d2d2d7] p-6">
              <h3 className="text-[16px] font-semibold text-[#1d1d1f]">{c.title}</h3>
              <p className="mt-2 text-[15px] font-medium text-[#1D6AE5]">{c.detail}</p>
              <p className="mt-1 text-[13px] text-[#86868b]">{c.sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-xl bg-[#f5f5f7] p-8 text-center">
          <p className="text-[15px] text-[#6e6e73]">
            TakeMe Mobility LLC &middot; Seattle, WA
          </p>
        </div>
      </div>
    </div>
  )
}
