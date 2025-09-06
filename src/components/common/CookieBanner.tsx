"use client";
import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setShowBanner(false);
    
    // Enable tracking/analytics here when implemented
    console.log("[COOKIE_CONSENT] Accepted - tracking enabled");
  };

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setShowBanner(false);
    
    // Ensure no tracking is loaded
    console.log("[COOKIE_CONSENT] Declined - no tracking");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 z-50">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 text-sm text-slate-300">
          <p>
            We use cookies to enhance your experience and for analytics. 
            By continuing, you consent to our use of cookies.{" "}
            <a 
              href="/privacy" 
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Privacy Policy
            </a>
            {" | "}
            <a 
              href="mailto:privacy@ditonachat.com" 
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Contact Privacy Team
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}