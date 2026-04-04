import Link from 'next/link'

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#d2d2d7]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] text-[#1d1d1f]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#86868b]">Help Center</span>
          </Link>
          <Link href="/" className="text-[14px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">Back to home</Link>
        </div>
      </header>
      <div className="mx-auto max-w-[800px] px-6 py-20 lg:px-10">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-[#1d1d1f]">Help Center</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[#6e6e73]">
          Need help? We are here for you 24/7.
        </p>
        <div className="mt-12 space-y-6">
          {[
            { q: 'How do I book a ride?', a: 'Enter your destination on the homepage, select a vehicle class, and confirm your ride.' },
            { q: 'How do I cancel a ride?', a: 'Go to your dashboard and tap the cancel button on your active ride.' },
            { q: 'How do I become a driver?', a: 'Visit the Driver Hub page and click "Apply Now" to start your application.' },
            { q: 'How does TakeMe Fleet work?', a: 'List your EV on TakeMe Fleet and earn passive income. We handle driver matching and payments.' },
            { q: 'How do I contact support?', a: 'Email support@takememobility.com or visit our Contact page.' },
          ].map((item) => (
            <div key={item.q} className="rounded-xl border border-[#d2d2d7] p-6">
              <h3 className="text-[16px] font-semibold text-[#1d1d1f]">{item.q}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#6e6e73]">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
