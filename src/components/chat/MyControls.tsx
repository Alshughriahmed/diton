'use client';

import { useCallback, useEffect, useState } from 'react';
import { emit, on } from '@/utils/events';
import { useProfile } from '@/state/profile';
import { useFilters } from '@/state/filters';
import { useHydrated } from '@/hooks/useHydrated';

export default function MyControls() {
  // ✅ جميع الـHooks في أعلى المكوّن وبترتيب ثابت
  const hydrated = useHydrated();
  const { profile, setProfile } = useProfile();
  const { isVip } = useFilters();

  const [likes, setLikes] = useState<number>(0);
  const [beauty, setBeauty] = useState<boolean>(false);

  // ✅ اشترك في الأحداث فقط بعد التحميل
  useEffect(() => {
    if (!hydrated) return;
    
    const offLikes = on('ui:likeUpdate', (d: any) => {
      if (d?.myLikes !== undefined) setLikes(d.myLikes);
    });
    const offBeauty = on('ui:toggleBeauty', (d: any) => setBeauty(!!d?.enabled));
    
    return () => {
      offLikes();
      offBeauty();
    };
  }, [hydrated]);

  // ✅ كولباكات للأدوات المحلية فقط
  const onBeauty = useCallback(() => {
    if (!isVip) {
      emit('ui:upsell', { feature: 'beauty' });
      return;
    }
    
    const newState = !beauty;
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
    setProfile(updatedProfile);
    setBeauty(newState);
    emit('ui:toggleBeauty', { enabled: newState });
  }, [isVip, beauty, profile, setProfile]);
  
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

  // إظهار المكون فقط بعد التحميل لمنع مشاكل Hydration
  if (!hydrated) return null;

  return (
    <div className="absolute top-4 right-4 z-30 flex gap-2">
      {/* تبديل الكاميرا */}
      <button 
        onClick={onSwitchCam} 
        aria-label="Switch camera" 
        className="w-12 h-12 rounded-lg bg-black/60 backdrop-blur-md hover:bg-black/80 transition-colors flex items-center justify-center text-white border border-white/20 shadow-lg"
      >
        🔄
      </button>
      
      {/* Beauty Effect */}
      <button 
        onClick={onBeauty} 
        aria-label="Beauty" 
        className={`relative w-12 h-12 rounded-lg transition-colors flex items-center justify-center border shadow-lg ${
          beauty && isVip
            ? 'bg-purple-500/50 border-purple-400 text-purple-200 backdrop-blur-md'
            : 'bg-black/60 hover:bg-black/80 border-white/20 text-white backdrop-blur-md'
        } ${!isVip ? 'opacity-60' : ''}`}
      >
        ✨
        {!isVip && (
          <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>
        )}
        {/* Beauty ON Indicator */}
        {beauty && isVip && (
          <div className="absolute -bottom-2 -right-1 bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-lg">
            ON
          </div>
        )}
      </button>
      
      {/* عداد الإعجابات */}
      <div className="flex items-center gap-1 px-3 py-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/20 shadow-lg">
        <span className="text-pink-400 text-sm">❤</span>
        <span className="text-white text-sm font-medium min-w-[16px] text-center">{likes}</span>
      </div>
    </div>
  );
}