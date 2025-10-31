// src/app/chat/components/ChatToolbar.tsx
"use client";

import { useCallback } from "react";

/**
 * شريط أدوات الدردشة السفلي.
 * متطلبات ثابتة:
 *  - سِمة data-toolbar موجودة لتجاهل السحب فوق الشريط.
 *  - زر الإعجاب يطلق:  window.dispatchEvent(new CustomEvent("ui:like:toggle"))
 *  - زر الإعدادات لا يغيّر route؛ يطلق: window.dispatchEvent(new CustomEvent("ui:openSettings"))
 *  - لا تبعيات جديدة. لا ENV جديدة.
 *
 * ملاحظات:
 *  - هذا الشريط لا يعرض عدّاد إعجابات A. العدّاد يُعرض أعلى يمين القسم السفلي كما في الواجهة.
 *  - أيقونات بemoji مطابقة للنمط الحالي في المشروع.
 */

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

export default function ChatToolbar() {
  const fire = useCallback((name: string) => {
    window.dispatchEvent(new CustomEvent(name));
  }, []);

  const onLike = useCallback(() => {
    vibrate(12);
    fire("ui:like:toggle");
  }, [fire]);

  const onSettings = useCallback(() => {
    vibrate(8);
    // لا نغيّر route حتى لا ينقطع الاتصال
    fire("ui:openSettings");
  }, [fire]);

  const onPrev = useCallback(() => {
    vibrate(14);
    fire("ui:prev");
  }, [fire]);

  const onNext = useCallback(() => {
    vibrate(14);
    fire("ui:next");
  }, [fire]);

  // اختياري: مرآة/تبديل/تجميل حسب الأحداث القائمة في المشروع
  const onMirror = useCallback(() => {
    vibrate(8);
    fire("ui:camera:mirror");
  }, [fire]);

  const onSwitchCam = useCallback(() => {
    vibrate(8);
    fire("ui:camera:switch");
  }, [fire]);

  const onBeauty = useCallback(() => {
    vibrate(8);
    fire("ui:beauty:toggle");
  }, [fire]);

  const onReport = useCallback(() => {
    vibrate(6);
    fire("ui:report:open");
  }, [fire]);

  const onMic = useCallback(() => {
    vibrate(6);
    fire("ui:mic:toggle");
  }, [fire]);

  const onHeadset = useCallback(() => {
    vibrate(6);
    fire("ui:spk:toggle");
  }, [fire]);

  return (
    <div
      data-toolbar
      className="
        pointer-events-auto
        absolute bottom-2 left-1/2 -translate-x-1/2
        flex items-center gap-3 rounded-2xl
        bg-neutral-900/70 border border-neutral-800/80
        px-3 py-2 shadow-lg
      "
    >
      {/* السابق / التالي */}
      <button
        type="button"
        aria-label="prev"
        onClick={onPrev}
        className="select-none rounded-xl bg-neutral-800/80 text-white/90 px-2 py-1"
      >
        ⏮️
      </button>
      <button
        type="button"
        aria-label="next"
        onClick={onNext}
        className="select-none rounded-xl bg-neutral-800/80 text-white/90 px-2 py-1"
      >
        ⏭️
      </button>

      {/* مرآة / تبديل كاميرا / تجميل */}
      <button
        type="button"
        aria-label="mirror"
        onClick={onMirror}
        className="select-none rounded-xl bg-neutral-800/80 text-white/90 px-2 py-1"
      >
        🔁
      </button>
      <button
        type="button"
        aria-label="switch-camera"
        onClick={onSwitchCam}
        className="select-none rounded-xl bg-neutral-800/80 text-white/90 px-2 py-1"
      >
        🎥
      </button>
      <button
        type="button"
        aria-label="beauty"
        onClick={onBeauty}
        className="select-none rounded-xl bg-neutral-800/80 text-white/90 px-2 py-1"
      >
        ✨
      </button>

      {/* ميكروفون / سماعات */}
      <button
        type="button"
        aria-label="mic-toggle"
        onClick={onMic}
        className="select-none rounded-xl bg-neutral-800/80 text-white/90 px-2 py-1"
      >
        🎙️
      </button>
      <button
        type="button"
        aria-label="speaker-toggle"
        onClick={onHeadset}
        className="select-none rounded-xl bg-neutral-800/80 text-white/90 px-2 py-1"
      >
        🎧
      </button>

      {/* الإعجاب */}
      <button
        type="button"
        aria-label="like-toggle"
        onClick={onLike}
        className="select-none rounded-xl bg-neutral-800/80 text-pink-400 px-2 py-1"
      >
        ❤️
      </button>

      {/* إعدادات */}
      <button
        type="button"
        aria-label="open-settings"
        onClick={onSettings}
        className="select-none rounded-xl bg-neutral-800/80 text-white/90 px-2 py-1"
      >
        ⚙️
      </button>

      {/* إبلاغ */}
      <button
        type="button"
        aria-label="report"
        onClick={onReport}
        className="select-none rounded-xl bg-neutral-800/80 text-red-400 px-2 py-1"
      >
        🚩
      </button>
    </div>
  );
}
