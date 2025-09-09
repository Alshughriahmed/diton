"use client";

import { useState, useEffect } from "react";
import { emit, on } from "@/utils/events";
import { useFilters } from "@/state/filters";

interface MyControlsProps {
  myLikes?: number;
  beautyEnabled?: boolean;
}

export default function MyControls({ myLikes = 0, beautyEnabled = false }: MyControlsProps) {
  const [likes, setLikes] = useState(myLikes);
  const [beauty, setBeauty] = useState(beautyEnabled);
  const { isVip } = useFilters();

  useEffect(() => {
    const offLikes = on("ui:likeUpdate", (data) => {
      if (data?.myLikes !== undefined) {
        setLikes(data.myLikes);
      }
    });

    const offBeauty = on("ui:toggleBeauty", (data) => {
      setBeauty(data?.enabled || false);
    });

    return () => {
      offLikes();
      offBeauty();
    };
  }, []);

  const handleCameraSwitch = async () => {
    // Save camera switch preference
    try {
      const { useProfile } = await import("@/state/profile");
      const profile = useProfile.getState().profile;
      // Toggle camera facing preference
      const currentFacing = profile.preferences?.camera?.facing || 'user';
      const newFacing = currentFacing === 'user' ? 'environment' : 'user';
      
      const updatedProfile = { 
        ...profile, 
        preferences: { 
          ...profile.preferences, 
          camera: {
            ...profile.preferences?.camera,
            facing: newFacing
          }
        } 
      };
      useProfile.getState().setProfile(updatedProfile);
    } catch (error) {
      console.warn('Failed to save camera preference:', error);
    }
    
    emit("ui:switchCamera");
  };

  const handleBeautyToggle = async () => {
    if (!isVip) {
      emit("ui:upsell", "beauty");
      return;
    }

    const newState = !beauty;
    
    // Save to profile store
    try {
      const { useProfile } = await import("@/state/profile");
      const profile = useProfile.getState().profile;
      const updatedProfile = { 
        ...profile, 
        preferences: { 
          ...profile.preferences, 
          beauty: {
            enabled: newState,
            strength: profile.preferences?.beauty?.strength ?? 50,
            brightness: profile.preferences?.beauty?.brightness ?? 50,
            smoothness: profile.preferences?.beauty?.smoothness ?? 50
          }
        } 
      };
      useProfile.getState().setProfile(updatedProfile);
    } catch (error) {
      console.warn('Failed to save beauty preference:', error);
    }
    
    emit("ui:toggleBeauty", { enabled: newState });
  };

  return (
    <div className="absolute top-3 right-3 z-30">
      <div className="bg-black/60 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          {/* Camera Switch */}
          <button
            onClick={handleCameraSwitch}
            className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white border border-white/10"
            aria-label="Switch Camera"
          >
            🔄
          </button>

          {/* Beauty Filter */}
          <button
            onClick={handleBeautyToggle}
            className={`w-10 h-10 rounded-lg transition-colors flex items-center justify-center border ${
              beauty && isVip
                ? 'bg-purple-500/30 border-purple-400 text-purple-300'
                : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
            } ${!isVip ? 'opacity-60' : ''}`}
            aria-label="Beauty Filter"
          >
            ✨
            {!isVip && (
              <span className="absolute -top-1 -right-1 text-xs">🔒</span>
            )}
          </button>

          {/* My Likes */}
          <div className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-lg border border-white/10">
            <span className="text-pink-400 text-sm">❤</span>
            <span className="text-white text-sm font-medium">{likes}</span>
          </div>
        </div>

        {/* Beauty ON Indicator */}
        {beauty && isVip && (
          <div className="absolute -bottom-2 right-0 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full shadow-lg">
            Beauty ON
          </div>
        )}
      </div>
    </div>
  );
}