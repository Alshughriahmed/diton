"use client";

import { useState, useEffect } from "react";
import { emit } from "@/utils/events";

function isMobileUA() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ("ontouchstart" in window);
}

export default function ChatToolbar() {
  const [msgOpen, setMsgOpen] = useState(false);

  // حالة الميديا من المصدر الحقيقي
  const [torchSupported, setTorchSupported] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [micReal, setMicReal] = useState<boolean>(true);

  useEffect(() => {
    const handleMediaState = (event: any) => {
      const d = event?.detail || {};
      if (typeof d.torchSupported === "boolean") setTorchSupported(!!d.torchSupported);
      if (d.facing === "user" || d.facing === "environment") setFacing(d.facing);
      if (typeof d.micOn === "boolean") setMicReal(!!d.micOn);
    };
    window.addEventListener("media:state", handleMediaState);
    return () => window.removeEventListener("media:state", handleMediaState);
  }, []);

  useEffect(() => {
    const onOpen = () => setMsgOpen(true);
    const onClose = () => setMsgOpen(false);
    window.addEventListener("ui:openMessaging", onOpen as any);
    window.addEventListener("ui:closeMessaging", onClose as any);
    return () => {
      window.removeEventListener("ui:openMessaging", onOpen as any);
      window.removeEventListener("ui:closeMessaging", onClose as any);
    };
  }, []);

  const onMobile = isMobileUA();
  const flashEnabled = torchSupported && facing === "environment";

  return (
    <>
      {/* Prev / Next large icons */}
      <button
        onClick={() => emit("ui:prev")}
        title="Previous"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] left-2 sm:left-3 z-[50] text-3xl sm:text-4xl select-none"
      >
        ⏮️
      </button>
      <button
        onClick={() => emit("ui:next")}
        data-ui="btn-next"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] right-2 sm:right-3 z-[50] text-3xl sm:text-4xl select-none"
      >
        ⏭️
      </button>

      {/* Bottom toolbar */}
      <section
        data-toolbar
        className="pointer-events-auto fixed inset-x-2 sm:inset-x-4 z-[60]"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div className="relative flex flex-row-reverse items-center gap-2 sm:gap-3 justify-center">
          {/* 💬 messages */}
          <button
            onClick={() => {
              const ev = msgOpen ? "ui:closeMessaging" : "ui:openMessaging";
              setMsgOpen(!msgOpen);
              emit(ev);
            }}
            aria-pressed={msgOpen}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg border text-white ${
              msgOpen ? "bg-purple-600/40 border-purple-400/60" : "bg-black/20 border-white/20 hover:bg-white/10"
            }`}
          >
            💬
          </button>

          {/* ❤ like */}
          <button
            onClick={() => emit("ui:like", { isLiked: true })}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-pink-600/30 text-white border border-pink-400/40 hover:bg-pink-500/40"
          >
            ❤
          </button>

          {/* 🔊 remote audio */}
          <button
            data-ui="btn-remote-audio"
            onClick={() => emit("ui:toggleRemoteAudio")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10"
          >
            🔊
          </button>

          {/* 🎤 mic — يعكس حالة المسار الفعلية */}
          <button
            data-ui="btn-mic"
            onClick={() => emit("ui:toggleMic")}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border ${
              micReal ? "bg-green-600/30 border-green-400/40" : "bg-red-600/30 border-red-400/40"
            }`}
            title={micReal ? "Mic On" : "Mic Off"}
          >
            {micReal ? "🎤" : "🔇"}
          </button>

          {/* ⚡ Flash — يبقى ويُعطّل تلقائيًا عند عدم دعم torch أو عند front */}
          {onMobile ? (
            <button
              data-ui="btn-flash"
              disabled={!flashEnabled}
              onClick={() => emit("ui:toggleTorch")}
              title={flashEnabled ? "Flash" : "Flash not supported"}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border ${
                flashEnabled
                  ? "bg-yellow-500/30 border-yellow-400/40 hover:bg-yellow-400/40"
                  : "bg-black/20 border-white/20 opacity-50 cursor-not-allowed"
              }`}
            >
              ⚡
            </button>
          ) : null}

          {/* ⚙️ settings */}
          <button
            data-ui="btn-settings"
            onClick={() => {
              try {
                window.location.href = "/settings";
              } catch {}
            }}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10"
          >
            ⚙️
          </button>

          {/* 🎭 masks */}
          <button
            data-ui="btn-masks"
            onClick={() => emit("ui:toggleMasks")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10"
          >
            🎭
          </button>

          {/* 🚩 report */}
          <button
            data-ui="btn-report"
            onClick={() => emit("ui:report")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-red-600/30 text-white border border-red-400/40 hover:bg-red-500/40"
          >
            🚩
          </button>
        </div>
      </section>
    </>
  );
}
