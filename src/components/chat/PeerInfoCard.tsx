"use client";

import { useState, useEffect } from "react";

interface PeerInfo {
  name: string;
  avatar?: string;
  isVip: boolean;
  likes: number;
  isOnline: boolean;
}

interface PeerInfoCardProps {
  peerInfo?: PeerInfo;
}

export default function PeerInfoCard({ peerInfo }: PeerInfoCardProps) {
  const [peer, setPeer] = useState<PeerInfo>(peerInfo || {
    name: "Connecting...",
    isVip: false,
    likes: 0,
    isOnline: false
  });

  useEffect(() => {
    // Listen for peer info updates from match data
    const handleMatchUpdate = (matchData: any) => {
      if (matchData?.peer) {
        setPeer({
          name: matchData.peer.name || "Anonymous",
          avatar: matchData.peer.avatar,
          isVip: matchData.peer.isVip || false,
          likes: matchData.peer.likes || 0,
          isOnline: true
        });
      }
    };

    // Listen for like updates
    const handleLikeUpdate = (data: any) => {
      if (data?.peerLikes !== undefined) {
        setPeer(prev => ({ ...prev, likes: data.peerLikes }));
      }
    };

    // Import event system dynamically to avoid SSR issues
    import("@/utils/events").then(({ on }) => {
      const offMatch = on("match:update" as any, handleMatchUpdate);
      const offLike = on("ui:likeUpdate", handleLikeUpdate);
      
      return () => {
        offMatch();
        offLike();
      };
    });
  }, []);

  useEffect(() => {
    if (peerInfo) {
      setPeer(peerInfo);
    }
  }, [peerInfo]);

  return (
    <div className="absolute top-3 left-3 z-30">
      <div className="bg-black/60 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
              {peer.avatar ? (
                <img 
                  src={peer.avatar} 
                  alt={peer.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-lg font-bold">
                  {peer.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {/* Online status */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black ${
              peer.isOnline ? 'bg-green-400' : 'bg-gray-400'
            }`} />
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm max-w-20 truncate">
                {peer.name}
              </span>
              {peer.isVip && (
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 px-1.5 py-0.5 rounded text-xs font-bold text-black">
                  VIP
                </div>
              )}
            </div>
            
            {/* Likes */}
            <div className="flex items-center gap-1 text-pink-400">
              <span className="text-sm">❤</span>
              <span className="text-xs font-medium">{peer.likes}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}