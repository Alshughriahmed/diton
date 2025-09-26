"use client";

import { useState, useEffect, useRef } from "react";
import { emit, on } from "@/utils/events";
import { safeFetch } from "@/app/chat/safeFetch";

interface LikeData {
  myLikes: number;
  peerLikes: number;
  isLiked: boolean;
  canLike: boolean;
}

export default function LikeSystem() {
  const [likeData, setLikeData] = useState<LikeData>({
    myLikes: 0,
    peerLikes: 0,
    isLiked: false,
    canLike: true
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // Polling function to get like count from server
  const pollLikeCount = async (pairId: string) => {
    if (!pairId || isPollingRef.current) return;
    
    try {
      const response = await safeFetch(`/api/like?pairId=${encodeURIComponent(pairId)}`, {
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const data = await response.json();
        setLikeData(prev => ({
          ...prev,
          peerLikes: data.count || 0,
          isLiked: data.mine || false,
          canLike: true
        }));
      }
    } catch (error) {
      console.warn('Failed to poll like count:', error);
    }
  };

  // Start polling for like updates
  const startPolling = (pairId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Poll immediately and then every 2 seconds
    pollLikeCount(pairId);
    pollingIntervalRef.current = setInterval(() => {
      pollLikeCount(pairId);
    }, 2000);
  };

  // Stop polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    // Listen for rtc:pair events to get pairId
    const unsubscribePair = on("rtc:pair" as any, (data) => {
      const pairId = data?.pairId;
      if (pairId && pairId !== currentPairId) {
        setCurrentPairId(pairId);
        // Reset like state for new pair
        setLikeData(prev => ({
          ...prev,
          peerLikes: 0,
          isLiked: false,
          canLike: true
        }));
        // Start polling for this new pair
        startPolling(pairId);
      }
    });

    // Listen for DataChannel close events
    const handleDataChannelClosed = () => {
      console.warn('[like] DataChannel closed, falling back to polling only');
      // DataChannel is now unavailable, increase polling frequency temporarily
      if (currentPairId) {
        startPolling(currentPairId);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener('ditona:datachannel-closed', handleDataChannelClosed);
    }

    // Listen for like updates from other components (backwards compatibility)
    const unsubscribeUpdate = on("ui:likeUpdate", (data) => {
      if (data) {
        setLikeData(prev => ({
          ...prev,
          ...data
        }));
      }
    });

    // Listen for rtc phase changes to stop polling when disconnected
    const unsubscribePhase = on("rtc:phase" as any, (data) => {
      if (data?.phase === 'idle' || data?.phase === 'stopped') {
        stopPolling();
        setCurrentPairId(null);
        setLikeData(prev => ({
          ...prev,
          peerLikes: 0,
          isLiked: false,
          canLike: true
        }));
      }
    });

    return () => {
      if (typeof unsubscribePair === 'function') unsubscribePair();
      if (typeof unsubscribeUpdate === 'function') unsubscribeUpdate();
      if (typeof unsubscribePhase === 'function') unsubscribePhase();
      stopPolling();
      
      // Cleanup DataChannel event listener
      if (typeof window !== "undefined") {
        window.removeEventListener('ditona:datachannel-closed', handleDataChannelClosed);
      }
    };
  }, [currentPairId]);

  const handleLike = async () => {
    if (!likeData.canLike || isAnimating || !currentPairId) return;

    const newIsLiked = !likeData.isLiked;
    const action = newIsLiked ? 'like' : 'unlike';
    
    // Store original state for potential rollback
    const originalState = { ...likeData };

    // Optimistic update - immediately update UI
    setLikeData(prev => ({
      ...prev,
      isLiked: newIsLiked,
      peerLikes: newIsLiked ? prev.peerLikes + 1 : Math.max(0, prev.peerLikes - 1),
      canLike: false // Disable button during request
    }));

    // Trigger animations
    setIsAnimating(true);
    if (newIsLiked) {
      
      try { if (typeof window !== "undefined") window.dispatchEvent(new Event("user:liked")); } catch(e) {}
setShowHeart(true);
      setTimeout(() => setShowHeart(false), 1000);
    }
    setTimeout(() => setIsAnimating(false), 300);

    try {
      // Send to server
      const response = await safeFetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pairId: currentPairId,
          action: action
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update with server response
        setLikeData(prev => ({
          ...prev,
          peerLikes: result.count || 0,
          isLiked: result.mine || false,
          canLike: true
        }));

        // Emit event for ChatClient compatibility
        emit("ui:like", {
          isLiked: result.mine || false,
          myLikes: result.count || 0,
          pairId: currentPairId
        });

        // Enhanced DataChannel sending with availability checks
        try {
          const dc = (globalThis as any).__ditonaDataChannel;
          // Comprehensive DataChannel availability check
          if (dc && 
              typeof dc.send === 'function' && 
              dc.readyState === 'open' && 
              !dc.error) {
            dc.send(JSON.stringify({
              type: "like:toggle",
              liked: result.mine || false,
              pairId: currentPairId
            }));
            console.log('[like] DataChannel message sent successfully');
          } else {
            console.warn('[like] DataChannel unavailable, falling back to API-only');
          }
        } catch (error) {
          console.warn('[like] DataChannel send failed:', error);
        }

      } else {
        // Server error - revert optimistic update
        console.warn('Like request failed:', response.status);
        setLikeData(prev => ({
          ...originalState,
          canLike: true
        }));
      }
    } catch (error) {
      console.warn('Failed to save like:', error);
      
      // Network error - revert optimistic update
      setLikeData(prev => ({
        ...originalState,
        canLike: true
      }));
    }
  };

  return (
    <div className="absolute top-4 right-4 z-30">
      <div className="flex flex-col items-center gap-2">
        {/* Peer Likes Display */}
        <div className="flex items-center gap-1 px-3 py-1 bg-black/50 backdrop-blur rounded-full border border-white/20">
          <span className="text-pink-400 text-sm">💖</span>
          <span className="text-white text-sm font-medium">{likeData.peerLikes}</span>
        </div>

        {/* Like Button */}
        <button
          onClick={handleLike}
          disabled={!likeData.canLike || isAnimating}
          className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            likeData.isLiked
              ? "bg-pink-500 border-pink-400 text-white scale-110"
              : "bg-black/50 border-white/30 text-white hover:border-pink-400 hover:bg-pink-500/20"
          } ${isAnimating ? "scale-125" : ""} ${!likeData.canLike ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={likeData.isLiked ? "Unlike" : "Like"}
        >
          <span className={`text-2xl transition-transform ${isAnimating ? "scale-125" : ""}`}>
            {likeData.isLiked ? "💗" : "🤍"}
          </span>

          {/* Floating heart animation */}
          {showHeart && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl animate-ping text-pink-400">💖</span>
            </div>
          )}

          {/* Ripple effect */}
          {isAnimating && (
            <div className="absolute inset-0 rounded-full border-2 border-pink-400 animate-ping opacity-30" />
          )}
        </button>

        {/* My Likes Counter */}
        <div className="flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur rounded-full border border-white/20">
          <span className="text-pink-400 text-xs">💕</span>
          <span className="text-white text-xs font-medium">{likeData.myLikes}</span>
        </div>
      </div>

      {/* Success message */}
      {showHeart && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-pink-500 text-white text-xs rounded-full whitespace-nowrap animate-fade-in-up">
          Added to friends! 💕
        </div>
      )}
    </div>
  );
}

/* CSS Animation styles */
const animationStyles = `
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in-up {
    animation: fade-in-up 0.3s ease-out;
  }
`;

// Inject styles
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = animationStyles;
  document.head.appendChild(styleSheet);
}