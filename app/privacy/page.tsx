import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#d2d2d7]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="text-[18px] text-[#1d1d1f]">
            <span className="font-semibold">TakeMe</span>
            <span className="ml-[5px] font-light text-[#86868b]">Privacy</span>
          </Link>
          <Link href="/" className="text-[14px] font-medium text-[#6e6e73] hover:text-[#1d1d1f]">Back to home</Link>
        </div>
      </header>
      <div className="mx-auto max-w-[800px] px-6 py-20 lg:px-10">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-[#1d1d1f]">Privacy Policy</h1>
        <p className="mt-2 text-[14px] text-[#86868b]">Last updated: April 4, 2026</p>
        <div className="mt-8 space-y-8 text-[15px] leading-[1.8] text-[#6e6e73]">
          <section>
            <h2 className="mb-3 text-[18px] font-semibold text-[#1d1d1f]">Information We Collect</h2>
            <p>We collect information you provide directly, such as your name, email, phone number, and payment details when you create an account or book a ride. We also collect location data during active rides to provide our service.</p>
          </section>
          <section>
            <h2 className="mb-3 text-[18px] font-semibold text-[#1d1d1f]">How We Use Your Information</h2>
            <p>We use your information to provide, maintain, and improve our services, process payments, communicate with you, and ensure safety for all users on our platform.</p>
          </section>
          <section>
            <h2 className="mb-3 text-[18px] font-semibold text-[#1d1d1f]">Data Security</h2>
            <p>We implement industry-standard security measures to protect your personal information. All data is encrypted in transit and at rest. We do not sell your personal data to third parties.</p>
          </section>
          <section>
            <h2 className="mb-3 text-[18px] font-semibold text-[#1d1d1f]">Contact</h2>
            <p>For privacy questions, contact us at privacy@takememobility.com or write to TakeMe Mobility LLC, Seattle, WA.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
