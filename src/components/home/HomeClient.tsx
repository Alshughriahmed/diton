"use client";

import { useEffect, useState } from "react";

type Props = { age?: string };

export default function HomeClient({ age }: Props) {
  const [showAgePrompt, setShowAgePrompt] = useState(false);

  useEffect(() => {
    if (age === "required") setShowAgePrompt(true);
  }, [age]);

  const handleStartChatting = async () => {
    try {
      const res = await fetch("/api/age/allow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) window.location.href = "/chat";
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold">DitonaChat</div>
          <nav className="hidden md:flex gap-6">
            <a href="/2257" className="text-slate-300 hover:text-white">2257</a>
            <a href="/terms" className="text-slate-300 hover:text-white">Terms</a>
            <a href="/privacy" className="text-slate-300 hover:text-white">Privacy</a>
            <a href="/plans" className="text-slate-300 hover:text-white">Plans</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 py-20">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          Meet. Chat. <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">Ditona</span>
        </h1>
        <p className="mt-6 text-lg text-slate-300 max-w-2xl">
          Fast one-tap matching. Private video chat. No sign-up required.
        </p>
        <div className="mt-8 flex gap-4">
          <button
            onClick={handleStartChatting}
            className="rounded-lg bg-fuchsia-600 px-6 py-3 font-semibold text-white hover:bg-fuchsia-500 active:scale-95 transition"
          >
            Start chatting
          </button>
            <a href="/plans" className="rounded-lg px-6 py-3 font-semibold text-slate-200 border border-slate-700 hover:border-slate-500">
            See plans
          </a>
        </div>
      </main>

      {/* Age prompt */}
      {showAgePrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-2">Age verification</h2>
            <p className="text-slate-300 mb-4">You must confirm that you are 18+ to continue.</p>
            <div className="flex justify-end gap-3">
              <a href="/" className="px-4 py-2 rounded border border-slate-700 text-slate-200">Cancel</a>
              <button onClick={handleStartChatting} className="px-4 py-2 rounded bg-fuchsia-600 text-white hover:bg-fuchsia-500">
                I’m 18+
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-24 py-8 text-center text-sm text-slate-400 border-t border-slate-800">
        © {new Date().getFullYear()} DitonaChat
      </footer>
    </div>
  );
}
