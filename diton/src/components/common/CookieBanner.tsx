"use client";
import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user has already accepted cookies
    const hasAccepted = localStorage.getItem('cookies_accepted');
    if (!hasAccepted) {
      setShowBanner(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookies_accepted', 'true');
    setShowBanner(false);
  };

  // Don't render on server-side
  if (!mounted || !showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 border-t border-gray-700 p-4 z-50">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-gray-300">
          <p>
            This site uses essential cookies for functionality. No tracking cookies are used.{' '}
            <a 
              href="/privacy" 
              className="text-blue-400 underline hover:text-blue-300"
            >
              Privacy Policy
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={acceptCookies}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
