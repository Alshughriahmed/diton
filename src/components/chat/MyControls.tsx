// src/components/chat/MyControls.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { emit, on } from "@/utils/events";
import { useProfile } from "@/state/profile";
import { useFilters } from "@/state/filters";
import { useHydrated } from "@/hooks/useHydrated";
import { useFFA } from "@/lib/useFFA";

export default function MyControls() {
  // Hooks أولاً
  const hydrated = useHydrated();
  const { profile, setProfile } = useProfile();
  const { isVip } = useFilters();
  const ffa = useFFA();

  // حالات الواجهة
  const [likes, setLikes] = useState<number>(0);
  const [beauty, setBeauty] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true); // MIRROR_DEFAULT=1

  // اشتراكات بعد التحميل
  useEffect(() => {
    if (!hydrated) return;

    // تزامن عداد إعجابات المستخدم المحلي
    const offUiLikeUpdate = on("ui:likeUpdate", (d: any) => {
      if (typeof d?.myLikes === "number") setLikes(d.myLikes);
    });
    // دعم البث الجديد like:sync
    const offLikeSync = on("like:sync", (d: any) => {
      if (typeof d?.myCount === "number") setLikes(Math.max(0, Number(d.myCount)));
      else if (d?.mine && typeof d?.count === "number") setLikes(Math.max(0, Number(d.count)));
    });

    const offBeauty = on("ui:toggleBeauty", (d: any) => setBeauty(!!d?.enabled));
    const offMirror = on("ui:toggleMirror", () => setIsMirrored((p) => !p));

    return () => {
      offUiLikeUpdate();
      offLikeSync();
      offBeauty();
      offMirror();
    };
  }, [hydrated]);

  // أزرار الأدوات
  const onBeauty = useCallback(() => {
    if (ffa || isVip) {
      const enabled = !beauty;
      setBeauty(enabled);
      emit("ui:toggleBeauty", { enabled });
    } else {
      emit("ui:upsell", { feature: "beauty", ref: "beauty" });
    }
  }, [ffa, isVip, beauty]);

  const onMirrorToggle = useCallback(() => {
    emit("ui:toggleMirror");
  }, []);

  const onSwitchCam = useCallback(() => {
    const currentFacing = profile.preferences?.camera?.facing || "user";
    const newFacing: "user" | "environment" = currentFacing === "user" ? "environment" : "user";
    setProfile({
      ...profile,
      preferences: {
        ...profile.preferences,
        camera: { facing: newFacing },
      },
    });
    emit("ui:switchCamera");
  }, [profile, setProfile]);

  // لا تُظهر شيئًا قبل الـ hydration
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

      {/* Mirror */}
      <button
        onClick={onMirrorToggle}
        aria-label="Mirror toggle"
        className={`relative w-12 h-12 rounded-lg transition-colors flex items-center justify-center border shadow-lg ${
          isMirrored
            ? "bg-blue-500/50 border-blue-400 text-blue-200 backdrop-blur-md"
            : "bg-black/60 hover:bg-black/80 border-white/20 text-white backdrop-blur-md"
        }`}
      >
        🪞
        {isMirrored && (
          <div className="absolute -bottom-2 -right-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-lg">
            ON
          </div>
        )}
      </button>

      {/* Beauty */}
      <button
        onClick={onBeauty}
        aria-label="Beauty"
        className={`relative w-12 h-12 rounded-lg transition-colors flex items-center justify-center border shadow-lg ${
          beauty && (ffa || isVip)
            ? "bg-purple-500/50 border-purple-400 text-purple-200 backdrop-blur-md"
            : "bg-black/60 hover:bg-black/80 border-white/20 text-white backdrop-blur-md"
        } ${!(ffa || isVip) ? "opacity-60" : ""}`}
      >
        ✨
        {!(ffa || isVip) && <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>}
        {beauty && (ffa || isVip) && (
          <div className="absolute -bottom-2 -right-1 bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-lg">
            ON
          </div>
        )}
      </button>

      {/* عداد الإعجابات فقط — لا زر قلب هنا */}
      <div className="flex items-center gap-1 px-3 py-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/20 shadow-lg">
        <span className="text-pink-400 text-sm">❤</span>
        <span className="text-white text-sm font-medium min-w-[16px] text-center">{likes}</span>
      </div>
    </div>
  );
}
