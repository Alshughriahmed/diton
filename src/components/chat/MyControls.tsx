// src/components/chat/MyControls.tsx
"use client";

import { useCallback, useEffect, useState } from 'react';
import { emit, on } from '@/utils/events';
import { useProfile } from '@/state/profile';
import { useFilters } from '@/state/filters';
import { useHydrated } from '@/hooks/useHydrated';
import { useFFA } from '@/lib/useFFA';

export default function MyControls() {
  // ✅ جميع الـHooks في أعلى المكوّن وبترتيب ثابت
  const hydrated = useHydrated();
  const { profile, setProfile } = useProfile();
  const { isVip } = useFilters();

  const [likes, setLikes] = useState<number>(0);
  const [beauty, setBeauty] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true); // MIRROR_DEFAULT=1

  // NEW
  const [likedByMe, setLikedByMe] = useState<boolean>(false); // NEW
  const [likePending, setLikePending] = useState<boolean>(false); // NEW

  // ✅ اشترك في الأحداث فقط بعد التحميل
  useEffect(() => {
    if (!hydrated) return;
    
    const offLikes = on('ui:likeUpdate', (d: any) => {
      if (d?.myLikes !== undefined) setLikes(d.myLikes);
    });
    const offBeauty = on('ui:toggleBeauty', (d: any) => setBeauty(!!d?.enabled));
    const offMirror = on('ui:toggleMirror', () => {
      setIsMirrored(prev => !prev);
    });
    const offLikeState = () => { /* no-op */ }; // placeholder

    // NEW: استمع لحالة الإعجاب لتمثيل الزر
    const offLike = on('like:state', (d: any)=>{
      if (typeof d?.likedByMe === 'boolean') setLikedByMe(!!d.likedByMe);
      if (typeof d?.pending === 'boolean') setLikePending(!!d.pending);
    });

    return () => {
      offLikes();
      offBeauty();
      offMirror();
      offLike();
      (offLikeState as any)?.();
    };
  }, [hydrated]);

  // ✅ كولباكات للأدوات المحلية فقط
  const ffa = useFFA();
  const onBeauty = useCallback(() => {
    if (ffa || isVip) {
      const newState = !beauty;
      setBeauty(newState);
      emit('ui:toggleBeauty', { enabled: newState });
      return;
    }
    emit('ui:upsell', { feature: 'beauty', ref: 'beauty' });
  }, [ffa, isVip, beauty]);
  
  const onMirrorToggle = useCallback(() => {
    emit('ui:toggleMirror');
  }, []);
  
  const onSwitchCam = useCallback(() => {
    const currentFacing = profile.preferences?.camera?.facing || 'user';
    const newFacing: 'user' | 'environment' = currentFacing === 'user' ? 'environment' : 'user';
    
    const updatedProfile = { 
      ...profile, 
      preferences: { 
        ...profile.preferences, 
        camera: {
          facing: newFacing
        }
      } 
    };
    setProfile(updatedProfile);
    emit('ui:switchCamera');
  }, [profile, setProfile]);

  // NEW: زر القلب يبعث حدثًا فقط
  const onLike = useCallback(() => {
    if (likePending) return;
    emit('ui:like');
  }, [likePending]);

  // إظهار المكون فقط بعد التحميل لمنع مشاكل Hydration
  if (!hydrated) return null;

  return (
    <div className="absolute top-2 right-2 z-30 flex gap-2">
      {/* تبديل الكاميرا */}
      <button 
        onClick={onSwitchCam} 
        aria-label="Switch camera" 
        className="w-12 h-12 rounded-lg bg-black/60 backdrop-blur-md hover:bg-black/80 transition-colors flex items-center justify-center text-white border border-white/20 shadow-lg"
      >
        🔄
      </button>
      
      {/* Mirror Toggle */}
      <button 
        onClick={onMirrorToggle} 
        aria-label="Mirror toggle" 
        className={`w-12 h-12 rounded-lg transition-colors flex items-center justify-center border shadow-lg ${
          isMirrored 
            ? 'bg-blue-500/50 border-blue-400 text-blue-200 backdrop-blur-md'
            : 'bg-black/60 hover:bg-black/80 border-white/20 text-white backdrop-blur-md'
        }`}
      >
        🪞
        {isMirrored && (
          <div className="absolute -bottom-2 -right-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-lg">
            ON
          </div>
        )}
      </button>

      {/* NEW: Like toggle */}
      <button
        onClick={onLike}
        aria-label="Like"
        disabled={likePending}
        className={`relative w-12 h-12 rounded-lg transition-colors flex items-center justify-center border shadow-lg ${
          likedByMe
            ? 'bg-pink-600/50 border-pink-400 text-pink-100 backdrop-blur-md'
            : 'bg-black/60 hover:bg-black/80 border-white/20 text-white backdrop-blur-md'
        } ${likePending ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        ❤
        {likedByMe && (
          <div className="absolute -bottom-2 -right-1 bg-pink-600 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-lg">
            ON
          </div>
        )}
      </button>
      
      {/* Beauty Effect */}
      <button 
        onClick={onBeauty} 
        aria-label="Beauty" 
        className={`relative w-12 h-12 rounded-lg transition-colors flex items-center justify-center border shadow-lg ${
          beauty && (ffa || isVip)
            ? 'bg-purple-500/50 border-purple-400 text-purple-200 backdrop-blur-md'
            : 'bg-black/60 hover:bg-black/80 border-white/20 text-white backdrop-blur-md'
        } ${!(ffa || isVip) ? 'opacity-60' : ''}`}
      >
        ✨
        {!(ffa || isVip) && (
          <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>
        )}
        {beauty && (ffa || isVip) && (
          <div className="absolute -bottom-2 -right-1 bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-lg">
            ON
          </div>
        )}
      </button>
      
      {/* عداد الإعجابات (محلي كما كان) */}
      <div className="flex items-center gap-1 px-3 py-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/20 shadow-lg">
        <span className="text-pink-400 text-sm">❤</span>
        <span className="text-white text-sm font-medium min-w-[16px] text-center">{likes}</span>
      </div>
    </div>
  );
}
