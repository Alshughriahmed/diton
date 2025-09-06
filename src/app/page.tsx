"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-white">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">DitonaChat</span>
          <span className="ml-2 rounded-full border border-fuchsia-400/40 px-2 py-0.5 text-xs text-fuchsia-300">18+</span>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm/6 text-slate-300">
          <Link href="/plans" className="hover:text-white">Plans</Link>
          <Link href="/chat" className="hover:text-white">Chat</Link>
          <Link href="/content" className="hover:text-white">Safety</Link>
        </nav>
      </header>

      <section className="relative">
        <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(60%_60%_at_50%_10%,rgba(217,70,239,0.25),rgba(79,70,229,0.15)_45%,transparent_70%)]" />
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-10 grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-5">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
              Meet. Match. <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400">Go Live.</span>
            </h1>
            <p className="text-slate-300 text-lg md:text-xl">
              18+ random video chat with smart gender & country filters. Fast, fun, and built for mobile.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/chat" className="inline-flex items-center justify-center rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 px-6 py-3 font-semibold shadow-lg shadow-fuchsia-500/20">
                Start chatting now
              </Link>
              <Link href="/plans" className="inline-flex items-center justify-center rounded-xl border border-slate-700 hover:border-slate-600 px-6 py-3 font-semibold">
                View VIP plans
              </Link>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-2">
              <span className="rounded-full bg-slate-800/60 px-3 py-1">STUN-first</span>
              <span className="rounded-full bg-slate-800/60 px-3 py-1">Privacy-first</span>
              <span className="rounded-full bg-slate-800/60 px-3 py-1">No signup required</span>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-video w-full rounded-2xl bg-slate-800/60 ring-1 ring-white/10 flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm text-slate-400">Preview</div>
                <div className="mt-2 text-slate-300">Connect instantly to someone new</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-slate-800/60 p-4 ring-1 ring-white/10">
                <div className="font-semibold">Quick Match</div>
                <div className="mt-1 text-slate-400">Swipe or tap Next</div>
              </div>
              <div className="rounded-xl bg-slate-800/60 p-4 ring-1 ring-white/10">
                <div className="font-semibold">Smart Filters</div>
                <div className="mt-1 text-slate-400">Gender & Countries</div>
              </div>
              <div className="rounded-xl bg-slate-800/60 p-4 ring-1 ring-white/10">
                <div className="font-semibold">VIP Boost</div>
                <div className="mt-1 text-slate-400">Priority matching</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          <Feature icon="💬" title="Instant" text="Meet new people in seconds with auto-next." />
          <Feature icon="🎥" title="HD Video" text="Optimized WebRTC with smart fallback." />
          <Feature icon="🛡️" title="Safety" text="Clear rules + quick reporting. 18+ only." />
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm text-slate-400">
          <div>© DitonaChat</div>
          <nav className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/dmca" className="hover:text-white">DMCA</Link>
            <Link href="/content" className="hover:text-white">Content Policy</Link>
            <Link href="/abuse" className="hover:text-white">Abuse</Link>
            <Link href="/2257" className="hover:text-white">2257</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-slate-900/60 p-6 ring-1 ring-white/10">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-semibold text-white">{title}</div>
      <div className="mt-1 text-slate-400">{text}</div>
    </div>
  );
}
