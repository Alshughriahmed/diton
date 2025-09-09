'use client';

import { useCallback, useEffect, useState } from 'react';
import { emit, on } from '@/utils/events';
import { useProfile } from '@/state/profile';
import { useFilters } from '@/state/filters';

export default function MyControls() {
  // ✅ جميع الـHooks في أعلى المكوّن وبترتيب ثابت
  const { profile, setProfile } = useProfile();
  const { isVip } = useFilters();

  const [likes, setLikes] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [beauty, setBeauty] = useState<boolean>(false);

  // ✅ اشترك في الأحداث دائمًا (لا تضع useEffect داخل شرط)
  useEffect(() => {
    const offLikes = on('ui:likeUpdate', (d: any) => {
      if (d?.myLikes !== undefined) setLikes(d.myLikes);
    });
    const offPause = on('ui:playPause' as any, (d: any) => setPaused(!!d?.paused));
    const offBeauty = on('ui:toggleBeauty', (d: any) => setBeauty(!!d?.enabled));
    
    return () => {
      offLikes();
      offPause();
      offBeauty();
    };
  }, []);

  // ✅ كولباكات ثابتة (بدون إنشاء Hooks حسب حالة)
  const onNext = useCallback(() => emit('ui:next'), []);
  const onPrev = useCallback(() => emit(isVip ? 'ui:prev' : 'ui:upsell', { feature: 'prev' }), [isVip]);
  const onTogglePeerAudio = useCallback(() => emit('ui:toggleRemoteAudio'), []);
  const onToggleMic = useCallback(() => emit('ui:toggleMic' as any), []);
  const onLike = useCallback(() => emit('ui:likeToggle' as any), []);
  const onMasks = useCallback(() => emit(isVip ? 'ui:toggleMasks' as any : 'ui:upsell' as any, { feature: 'masks' }), [isVip]);
  const onSettings = useCallback(() => emit('ui:openSettings' as any), []);
  const onPlayPause = useCallback(() => emit('ui:togglePlay' as any), []);
  const onReport = useCallback(() => emit('ui:reportAndNext' as any), []);
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

  // ✅ JSX فقط (لا Hooks داخل شروط)
  return (
    <div className="pointer-events-auto">
      {/* أعلى يمين - أدواتي: تبديل كاميرا + تجميل + عدّاد إعجاباتي */}
      <div className="absolute top-3 right-3 z-30">
        <div className="bg-black/60 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-lg">
          <div className="flex items-center gap-2">
            <button 
              onClick={onSwitchCam} 
              aria-label="Switch camera" 
              className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white border border-white/10"
            >
              🔄
            </button>
            <button 
              onClick={onBeauty} 
              aria-label="Beauty" 
              className={`w-10 h-10 rounded-lg transition-colors flex items-center justify-center border ${
                beauty && isVip
                  ? 'bg-purple-500/30 border-purple-400 text-purple-300'
                  : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
              } ${!isVip ? 'opacity-60' : ''}`}
            >
              ✨
              {!isVip && (
                <span className="absolute -top-1 -right-1 text-xs">🔒</span>
              )}
            </button>
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

      {/* شريط الأدوات السفلي (يمين→يسار): Next, mute peer, mic, like, masks, settings, pause, report, Prev */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-3 bg-black/40 backdrop-blur rounded-2xl px-4 py-2">
        <button onClick={onNext} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium">Next</button>
        <button onClick={onTogglePeerAudio} className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white">🔈</button>
        <button onClick={onToggleMic} className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white">🎙️</button>
        <button onClick={onLike} className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white">❤</button>
        <button onClick={onMasks} className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white">
          🤡{!isVip && <span className="text-xs">🔒</span>}
        </button>
        <button onClick={onSettings} className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white">⚙️</button>
        <button onClick={onPlayPause} className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white">
          {paused ? '▶️' : '⏸️'}
        </button>
        <button onClick={onReport} className="w-10 h-10 rounded-lg bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center text-white">🚩</button>
        <button onClick={onPrev} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 rounded-lg text-white font-medium">
          {isVip ? 'Prev' : 'Prev🔒'}
        </button>
      </div>
    </div>
  );
}