// src/app/chat/components/ChatToolbar.tsx
"use client";

import { useCallback } from "react";

function vibrate(ms: number) {
  try { navigator.vibrate?.(ms); } catch {}
}
function fire(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

export default function ChatToolbar() {
  const onPrev = useCallback(() => { vibrate(14); fire("ui:prev"); }, []);
  const onNext = useCallback(() => { vibrate(14); fire("ui:next"); }, []);
  const onLike = useCallback(() => { vibrate(12); fire("ui:like:toggle"); }, []);
  const onSettings = useCallback(() => { vibrate(8); fire("ui:openSettings"); }, []);
  const onMirror = useCallback(() => { vibrate(8); fire("ui:camera:mirror"); }, []);
  const onSwitchCam = useCallback(() => { vibrate(8); fire("ui:camera:switch"); }, []);
  const onBeauty = useCallback(() => { vibrate(8); fire("ui:beauty:toggle"); }, []);
  const onMic = useCallback(() => { vibrate(6); fire("ui:mic:toggle"); }, []);
  const onSpk = useCallback(() => { vibrate(6); fire("ui:spk:toggle"); }, []);
  const onReport = useCallback(() => { vibrate(6); fire("ui:report:open"); }, []);

  return (
    <div
      data-toolbar
      className="
        fixed left-1/2 -translate-x-1/2
        z-[120] pointer-events-auto
      "
      // حافة آمنة على الموبايل لمنع القطع أسفل الشاشة
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
    >
      <div
        className="
          flex items-center gap-3
          px-2 py-1
          rounded-2xl
          bg-transparent    /* صندوق شفاف تمامًا */
          shadow-none border-0
        "
      >
        {/* السابق / التالي */}
        <button type="button" aria-label="prev"
          onClick={onPrev}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-white/90 hover:bg-white/10">
          ⏮️
        </button>
        <button type="button" aria-label="next"
          onClick={onNext}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-white/90 hover:bg-white/10">
          ⏭️
        </button>

        {/* مرآة / تبديل كاميرا / تجميل */}
        <button type="button" aria-label="mirror"
          onClick={onMirror}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-white/90 hover:bg-white/10">
          🔁
        </button>
        <button type="button" aria-label="switch-camera"
          onClick={onSwitchCam}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-white/90 hover:bg-white/10">
          🎥
        </button>
        <button type="button" aria-label="beauty"
          onClick={onBeauty}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-white/90 hover:bg-white/10">
          ✨
        </button>

        {/* ميكروفون / سماعات */}
        <button type="button" aria-label="mic-toggle"
          onClick={onMic}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-white/90 hover:bg-white/10">
          🎙️
        </button>
        <button type="button" aria-label="speaker-toggle"
          onClick={onSpk}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-white/90 hover:bg-white/10">
          🎧
        </button>

        {/* إعجاب */}
        <button type="button" aria-label="like-toggle"
          onClick={onLike}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-pink-400 hover:bg-white/10">
          ❤️
        </button>

        {/* إعدادات */}
        <button type="button" aria-label="open-settings"
          onClick={onSettings}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-white/90 hover:bg-white/10">
          ⚙️
        </button>

        {/* إبلاغ */}
        <button type="button" aria-label="report"
          onClick={onReport}
          className="select-none px-2 py-1 rounded-xl bg-transparent text-red-400 hover:bg-white/10">
          🚩
        </button>
      </div>
    </div>
  );
}
