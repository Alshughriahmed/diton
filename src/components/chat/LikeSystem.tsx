"use client";

import { useState, useEffect } from "react";
import { emit, on } from "@/utils/events";

interface LikeData {
  myLikes: number;
  peerLikes: number;
  isLiked: boolean;
  canLike: boolean;
}

export default function LikeSystem() {
  const [likeData, setLikeData] = useState<LikeData>({
    myLikes: 0,
    peerLikes: 123,
    isLiked: false,
    canLike: true
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHeart, setShowHeart] = useState(false);

  useEffect(() => {
    // Listen for like updates from other components
    const unsubscribe = on("ui:likeUpdate", (data) => {
      setLikeData(data);
    });

    return unsubscribe;
  }, []);

  const handleLike = () => {
    if (!likeData.canLike || isAnimating) return;

    const newIsLiked = !likeData.isLiked;
    const newMyLikes = newIsLiked 
      ? likeData.myLikes + 1 
      : Math.max(0, likeData.myLikes - 1);

    // Update local state immediately for responsiveness
    setLikeData(prev => ({
      ...prev,
      isLiked: newIsLiked,
      myLikes: newMyLikes
    }));

    // Trigger animations
    setIsAnimating(true);
    if (newIsLiked) {
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 1000);
    }
    setTimeout(() => setIsAnimating(false), 300);

    // Emit event for ChatClient to handle
    emit("ui:like", {
      isLiked: newIsLiked,
      myLikes: newMyLikes
    });

    // Send to server for persistence
    fetch('/api/user/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: newIsLiked ? 'like' : 'unlike',
        timestamp: Date.now()
      })
    }).catch(error => {
      console.warn('Failed to save like:', error);
      // Revert on failure
      setLikeData(prev => ({
        ...prev,
        isLiked: !newIsLiked,
        myLikes: likeData.myLikes
      }));
    });
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