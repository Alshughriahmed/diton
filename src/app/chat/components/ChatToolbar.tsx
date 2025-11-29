// src/app/chat/components/ChatToolbar.tsx
"use client";
import { useEffect, useState } from "react";
import { emit } from "@/utils/events";
import { useFFA } from "@/lib/useFFA";
import { vibrate } from "@/lib/vibrate";

function isMobileUA() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || "ontouchstart" in window;
}

function hapticBump(el?: HTMLElement | null, ms = 120) {
  try {
    // بديل للـ vibration على سطح المكتب
    el?.animate?.(
      [{ transform: "scale(1)" }, { transform: "scale(0.92)" }, { transform: "scale(1)" }],
      { duration: ms, easing: "ease-out" }
    );
  } catch {}
}

export default function ChatToolbar() {
  const ffa = useFFA();
  const [msgOpen, setMsgOpen] = useState(false);

  const dc = (globalThis as any).__ditonaDataChannel;
  const [pairId, setPairId] = useState<string | null>(null);

  const [torchSupported, setTorchSupported] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [micOn, setMicOn] = useState<boolean>(true);
  const [remoteMuted, setRemoteMuted] = useState<boolean>(false);

  useEffect(() => {
    const onPair = (e: any) => setPairId(e?.detail?.pairId || null);
    const onMediaState = (e: any) => {
      const d = e?.detail || {};
      if (typeof d.torchSupported === "boolean") setTorchSupported(!!d.torchSupported);
      if (d.facing === "user" || d.facing === "environment") setFacing(d.facing);
      if (typeof d.micOn === "boolean") setMicOn(!!d.micOn);
      if (typeof d.remoteMuted === "boolean") setRemoteMuted(!!d.remoteMuted);
    };
    const onToggleRemoteAudio = () => setRemoteMuted(v => !v);

    window.addEventListener("rtc:pair", onPair as any);
    window.addEventListener("media:state", onMediaState as any);
    window.addEventListener("ui:toggleRemoteAudio", onToggleRemoteAudio as any);

    return () => {
      window.removeEventListener("rtc:pair", onPair as any);
      window.removeEventListener("media:state", onMediaState as any);
      window.removeEventListener("ui:toggleRemoteAudio", onToggleRemoteAudio as any);
    };
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

  const canPrev = ffa || (dc?.readyState === "open" && pairId);
  const onMobile = isMobileUA();
  const flashEnabled = torchSupported && facing === "environment";

  return (
    <>
      <button
        onClick={(e) => { if (canPrev) { vibrate(25); hapticBump(e.currentTarget as HTMLElement); emit("ui:prev"); } }}
        disabled={!canPrev}
        title={!canPrev ? "Available during active connection or FFA" : "Previous match"}
        className={`fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] left-2 sm:left-3 z-[50] text-3xl sm:text-4xl select-none ${!canPrev ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >⏮️</button>

      <button
        onClick={(e) => { vibrate(25); hapticBump(e.currentTarget as HTMLElement); emit("ui:next"); }}
        data-ui="btn-next"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] right-2 sm:right-3 z-[50] text-3xl sm:text-4xl select-none"
      >⏭️</button>

      <section data-toolbar className="pointer-events-auto fixed inset-x-2 sm:inset-x-4 z-[60]" style={{ bottom: "calc(env(safe-area-inset-bottom) + 8px)" }}>
        <div className="relative flex flex-row-reverse items-center gap-2 sm:gap-3 justify-center">
          <button
            onClick={() => { const ev = msgOpen ? "ui:closeMessaging" : "ui:openMessaging"; setMsgOpen(!msgOpen); emit(ev); }}
            aria-pressed={msgOpen}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg border text-white ${msgOpen ? "bg-purple-600/40 border-purple-400/60" : "bg-black/20 border-white/20 hover:bg-white/10"}`}
            title="Messages"
          >💬</button>

          {/* Like */}
          <button
            onClick={(e) => { vibrate(14); hapticBump(e.currentTarget as HTMLElement); emit("ui:like:toggle", { liked: undefined }); }}
            aria-label="Like"
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-pink-600/30 text-white border border-pink-400/40 hover:bg-pink-500/40"
            title="Like"
          >❤️</button>

          <button
            data-ui="btn-remote-audio"
            onClick={() => emit("ui:toggleRemoteAudio")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10"
            title={remoteMuted ? "Remote muted" : "Remote unmuted"}
          >{remoteMuted ? "🔇" : "🔊"}</button>

          <button
            data-ui="btn-mic"
            onClick={() => emit("ui:toggleMic")}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border ${micOn ? "bg-green-600/30 border-green-400/40" : "bg-red-600/30 border-red-400/40"}`}
            title={micOn ? "Mic On" : "Mic Off"}
          >{micOn ? "🎤" : "🎤🚫"}</button>

          {onMobile ? (
            <button
              data-ui="btn-flash"
              disabled={!flashEnabled}
              onClick={() => emit("ui:toggleTorch")}
              title={flashEnabled ? "Flash" : "Flash not supported"}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border ${flashEnabled ? "bg-yellow-500/30 border-yellow-400/40 hover:bg-yellow-400/40" : "bg-black/20 border-white/20 opacity-50 cursor-not-allowed"}`}
            >⚡</button>
          ) : null}

          <button data-ui="btn-settings" onClick={() => { try { window.location.href = "/settings"; } catch {} }}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10" title="Settings">⚙️</button>

          <button data-ui="btn-masks" onClick={() => emit("ui:toggleMaskTray")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10" title="Masks">🎭</button>

          <button data-ui="btn-report" onClick={() => emit("ui:report")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-red-600/30 text-white border border-red-400/40 hover:bg-red-500/40" title="Report">🚩</button>
        </div>
      </section>
    </>
  );
}
