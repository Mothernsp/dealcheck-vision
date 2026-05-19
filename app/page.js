import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col min-h-full bg-white">
      <nav className="border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-8 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-zinc-900">DealCheck Vision</span>
          <div className="flex items-center gap-3">
            {userId ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
              >
                Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-8 py-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          BC F&amp;I Compliance
        </div>
        <h1 className="max-w-lg text-4xl font-semibold tracking-tight text-zinc-900 leading-[1.15] mb-5">
          AI-powered deal compliance for BC auto dealers
        </h1>
        <p className="max-w-sm text-base text-zinc-500 leading-relaxed mb-10">
          Upload deal documents and get instant compliance checks against BC Motor Dealer Act requirements.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-up"
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </main>

      <section className="max-w-5xl mx-auto w-full px-8 pb-24 grid grid-cols-3 gap-5">
        {[
          {
            title: 'OCR & Classification',
            desc: 'Automatically classifies bill of sale, Carfax reports, finance contracts, and more using Claude Vision.',
          },
          {
            title: 'Compliance Checks',
            desc: 'Validates against BC Motor Dealer Act and MVSA requirements with itemised pass/warn/fail results.',
          },
          {
            title: 'Math Verification',
            desc: 'Reconciles pricing, fees and financed amounts to catch calculation errors before they escalate.',
          },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 mb-1.5">{f.title}</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
