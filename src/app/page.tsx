import Link from "next/link";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/JsonLd";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-4 py-5">
        <span className="text-xl font-bold tracking-tight">DitonaChat</span>
        <nav className="hidden sm:flex items-center gap-6 text-slate-300">
          <Link href="/plans" className="hover:text-white">Plans</Link>
          <Link href="/chat" className="hover:text-white">Chat</Link>
          <Link href="/content" className="hover:text-white">Safety</Link>
        </nav>
      </header>

      <section className="relative">
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-16 grid md:grid-cols-2 gap-8 items-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            Meet. Match. <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400">Go Live.</span>
          </h1>
          <p className="text-slate-300 text-lg md:text-xl">
            18+ random video chat with smart gender & country filters. Fast, fun, and built for mobile.
          </p>
          <div className="flex gap-3">
            <button id="cta-chat" className="rounded-xl px-4 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium">
              Start chatting now
            </button>
            <Link className="rounded-xl px-4 py-3 bg-slate-800/60 hover:bg-slate-800 text-slate-100" href="/plans">
              View VIP plans
            </Link>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-4 py-10 text-sm text-slate-400 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/dmca">DMCA</Link>
        <Link href="/content">Content Policy</Link>
        <Link href="/abuse">Abuse</Link>
      </footer>

      {/* Auto-age gate CTA */}
      <script suppressHydrationWarning dangerouslySetInnerHTML={{__html: `
        document.addEventListener('click', (e) => {
          const t = e.target;
          if (!t) return;
          const btn = t.closest('#cta-chat');
          if (!btn) return;
          e.preventDefault();
          fetch('/api/age/allow', { method: 'POST' }).then(() => location.assign('/chat')).catch(() => location.assign('/chat'));
        });
      `}} />
      
      <OrganizationJsonLd />
      <WebSiteJsonLd />
    </main>
  );
}
