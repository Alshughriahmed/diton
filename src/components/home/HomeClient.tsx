"use client";

import { useState } from "react";

interface HomeClientProps {
  showAgePrompt?: boolean;
}

export default function HomeClient({ showAgePrompt = false }: HomeClientProps) {
  const [isVerifying, setIsVerifying] = useState(false);

  const handleStartChatting = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch("/api/age/allow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        window.location.href = "/chat";
      } else {
        console.error("Age verification failed");
        setIsVerifying(false);
      }
    } catch (error) {
      console.error("Error during age verification:", error);
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-white">DitonaChat</div>
          <nav className="hidden md:flex gap-6">
            <a href="/plans" className="hover:text-blue-400 transition-colors">Plans</a>
            <a href="/chat" className="hover:text-blue-400 transition-colors">Chat</a>
            <a href="/content" className="hover:text-blue-400 transition-colors">Safety</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Meet. Match. Go Live.
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Connect with people worldwide in random video chats. Smart filters for gender and country preferences. 18+ only.
            </p>
            
            {showAgePrompt && (
              <div className="bg-orange-900/30 border border-orange-500 rounded-lg p-4 mb-8 max-w-md mx-auto">
                <p className="text-orange-200">Please verify you are 18+ to continue</p>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button 
                onClick={handleStartChatting}
                disabled={isVerifying}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? "Verifying..." : "Start Chatting Now"}
              </button>
              <a 
                href="/plans"
                className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all border border-slate-600"
              >
                View VIP Plans
              </a>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="border-t border-slate-800">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="p-6">
                <div className="text-4xl mb-4">🌍</div>
                <h3 className="text-xl font-semibold mb-2">Global Connections</h3>
                <p className="text-slate-400">Meet people from around the world with country filters</p>
              </div>
              <div className="p-6">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-xl font-semibold mb-2">Instant Matching</h3>
                <p className="text-slate-400">Quick connections with smart gender preferences</p>
              </div>
              <div className="p-6">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="text-xl font-semibold mb-2">Safe & Secure</h3>
                <p className="text-slate-400">Moderated platform with privacy protection</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/dmca" className="hover:text-white transition-colors">DMCA</a>
            <a href="/content" className="hover:text-white transition-colors">Content</a>
          </div>
          <div className="text-center text-slate-500 text-sm mt-4">
            © 2025 DitonaChat. 18+ Adult Platform.
          </div>
        </div>
      </footer>
    </div>
  );
}
