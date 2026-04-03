'use client';

import Link from 'next/link';
import ConnectCard from '@/components/ConnectCard';

export default function ConnectPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-[#FEF2F2]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] tracking-[0.01em] text-[#0A0A0A]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#9CA3AF]">Connect</span>
          </Link>
          <Link href="/" className="text-[14px] font-medium text-[#6B7280] hover:text-[#0A0A0A]">
            Back to home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pt-20 pb-16 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#34C759]">
              For drivers
            </p>
            <h1 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#0A0A0A]">
              Never lose a ride
              <br />
              again.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-[1.65] text-[#6B7280]">
              Zero dropped trips. Zero missed income.
              <br />
              Built for drivers who don't tolerate downtime.
            </p>
            <p className="mt-4 text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A]">
              $29.90<span className="text-[15px] font-medium text-[#6B7280]">/month</span>
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-6">
              {[
                { value: 'Unlimited', label: 'Data & Calls' },
                { value: 'No', label: 'Contract' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[24px] font-bold tabular-nums text-[#0A0A0A]">{stat.value}</p>
                  <p className="text-[12px] font-medium uppercase tracking-wider text-[#6B7280]">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <Link
                href="/driver/connect"
                className="inline-flex h-[52px] items-center rounded-[999px] bg-[#D42B2B] px-8 text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-[#B91C1C] active:scale-[0.98]"
              >
                Start earning without interruptions
              </Link>
            </div>
          </div>

          {/* Right */}
          <div className="mx-auto w-full max-w-sm">
            <ConnectCard />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#FEF2F2]">
        <div className="mx-auto max-w-[1200px] px-6 py-20 lg:px-10">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { title: 'Always online', desc: 'Unlimited data keeps maps, navigation, and ride apps running without interruption.', icon: 'M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z' },
              { title: 'No commitment', desc: 'Month-to-month. Cancel anytime from your dashboard.', icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z' },
              { title: 'Designed for driving', desc: 'Optimized for ride-hailing, GPS, and real-time communication.', icon: 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z' },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF2F2]">
                  <svg className="h-5 w-5 text-[#0A0A0A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-[16px] font-semibold text-[#0A0A0A]">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#6B7280]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-xl px-6 py-20 text-center">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-[#0A0A0A]">
            Stay on the road.
          </h2>
          <p className="mt-4 text-[16px] text-[#6B7280]">
            Activate in under a minute. Cancel anytime.
          </p>
          <div className="mt-8">
            <Link
              href="/driver/connect"
              className="inline-flex h-[52px] items-center rounded-[999px] bg-[#D42B2B] px-8 text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-[#B91C1C]"
            >
              Activate plan
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
