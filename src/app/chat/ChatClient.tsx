"use client";

/* ======================= boot / guards ======================= */
import safeFetch from "@/app/chat/safeFetch";
import "@/app/chat/metaInit.client";
import "@/app/chat/peerMetaUi.client";
import "./freeForAllBridge";
import "./dcMetaResponder.client";
import "./likeSyncClient";
import "./msgSendClient";

if (process.env.NODE_ENV !== "production") {
  if (typeof window !== "undefined") {
    // silence AbortError rejections
    window.addEventListener("unhandledrejection", (e) => {
      const r = (e as any).reason;
      const msg = String((r && r.message) || "");
      if ((r && r.name === "AbortError") || /aborted/i.test(msg)) e.preventDefault();
    });
  }
}

/* ======================= react & app hooks ======================= */
import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";

import { useNextPrev } from "@/hooks/useNextPrev";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGestures } from "@/hooks/useGestures";
import { useHydrated } from "@/hooks/useHydrated";

import {
  initLocalMedia,
  getLocalStream,
  toggleMic,
  toggleCam,
  switchCamera,
} from "@/lib/media";

import { useFilters } from "@/state/filters";
import { useFFA } from "@/lib/useFFA";
import { useRouter } from "next/navigation";
import { getMobileOptimizer } from "@/lib/mobile";
import { toast } from "@/lib/ui/toast";
import { tryPrevOrRandom } from "@/lib/match/controls";
import { useProfile } from "@/state/profile";

/* ======================= LiveKit ======================= */
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  Track,
  RemoteTrack,
} from "livekit-client";

/* ======================= UI components ======================= */
import ChatComposer from "@/components/chat/ChatComposer";
import LikeSystem from "@/components/chat/LikeSystem";
import PeerInfoCard from "@/components/chat/PeerInfoCard";
import PeerMetadata from "@/components/chat/PeerMetadata";
import MyControls from "@/components/chat/MyControls";
import UpsellModal from "@/components/chat/UpsellModal";
import ChatToolbar from "./components/ChatToolbar";
import ChatMessagingBar from "./components/ChatMessagingBar";
import MessageHud from "./components/MessageHud";
import FilterBar from "./components/FilterBar";
import LikeHud from "./LikeHud";

/* ======================= types / consts ======================= */
type MatchEcho = { ts: number; gender: string; countries: string[] };
const NEXT_COOLDOWN_MS = 700;
const isBrowser = typeof window !== "undefined";

/* ============================================================= */

export default function ChatClient() {
  const ffa = useFFA();
  const router = useRouter();
  const hydrated = useHydrated();
  const { next, prev } = useNextPrev();

  // ===== local refs / state
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const lastNextTsRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [like, setLike] = useState(false);
  const [peerLikes, setPeerLikes] = useState(0);

  const [rtcPhase, setRtcPhase] = useState<"idle" | "searching" | "matched" | "connected" | "stopped">("idle");
  const [pair, setPair] = useState<{ id?: string; role?: "caller" | "callee" }>({});

  const { isVip: vip } = useFilters();
  const { profile } = useProfile();

  const [beauty, setBeauty] = useState(false);
  const [effectsStream, setEffectsStream] = useState<MediaStream | null>(null);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraPermissionHint, setCameraPermissionHint] = useState<string>("");

  // LiveKit room + single-flight guards
  const lkRoomRef = useRef<Room | null>(null);
  const joiningRef = useRef(false);

  /* ---------- helpers ---------- */
  function updatePeerBadges(meta: any) {
    try {
      if (!meta || !isBrowser) return;
      const g = document.querySelector('[data-ui="peer-gender"]');
      const ctry = document.querySelector('[data-ui="peer-country"]');
      const cty = document.querySelector('[data-ui="peer-city"]');
      if (g) (g as HTMLElement).textContent = meta.gender ? String(meta.gender) : "—";
      if (ctry) (ctry as HTMLElement).textContent = meta.country ? String(meta.country) : "—";
      if (cty) (cty as HTMLElement).textContent = meta.city ? String(meta.city) : "";
    } catch {}
  }

  /* ---------- peer-meta-ui (badges) ---------- */
  useEffect(() => {
    if (!isBrowser) return;
    const handler = (event: any) => {
      try {
        const meta = event.detail;
        if (meta) {
          setPeerInfo((p) => ({
            ...p,
            country: meta.country ?? p.country,
            city: meta.city ?? p.city,
            gender: meta.gender ?? p.gender,
          }));
          updatePeerBadges(meta);
          console.log("UI_META", meta);
        }
      } catch {}
    };
    window.addEventListener("ditona:peer-meta-ui", handler as any);
    return () => window.removeEventListener("ditona:peer-meta-ui", handler as any);
  }, []);

  /* ---------- peer meta from remote (events) ---------- */
  const [peerInfo, setPeerInfo] = useState({
    name: "Anonymous",
    isVip: false,
    likes: 0,
    isOnline: true,
    country: "",
    city: "",
    gender: "",
    age: 0,
  });

  const handlePeerMeta = (e: any) => {
    const meta = e.detail;
    if (!meta) return;
    setPeerInfo((prev) => ({
      ...prev,
      country: meta.country ?? prev.country,
      gender: meta.gender ?? prev.gender,
    }));
    updatePeerBadges(meta);
  };

  /* ---------- autostart ---------- */
  useEffect(() => {
    if (!hydrated || !isBrowser) return;
    if ((window as any).__ditonaAutostartDone) return;
    (window as any).__ditonaAutostartDone = 1;

    const doAutoStart = async () => {
      try {
        const { prefetchGeo } = await import("@/lib/geoCache");
        prefetchGeo();

        await new Promise((r) => setTimeout(r, 300));

        const stream = await initLocalMedia();
        if (stream && localRef.current) {
          localRef.current.srcObject = stream;
          localRef.current.play().catch(() => {});
        }

        await new Promise((r) => setTimeout(r, 150));
        window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "boot" } }));

        // optional: age/allow
        try {
          await safeFetch("/api/age/allow", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
          });
        } catch {}

        emit("ui:next");
      } catch (err) {
        console.warn("[auto-start] Failed:", err);
      }
    };

    const t = setTimeout(doAutoStart, 100);
    return () => clearTimeout(t);
  }, [hydrated]);

  /* ---------- global UI events ---------- */
  useKeyboardShortcuts();
  useGestures();

  useEffect(() => {
    // media & controls
    const off1 = on("ui:toggleMic", () => toggleMic());
    const off2 = on("ui:toggleCam", () => toggleCam());

    const off3 = on("ui:switchCamera", async () => {
      try {
        const newStream = await switchCamera();
        if (localRef.current && newStream) {
          localRef.current.srcObject = newStream;
          localRef.current.play().catch(() => {});
        }
        // republish switched tracks to LiveKit
        const room = lkRoomRef.current;
        if (room) {
          try {
            const lp: any = room.localParticipant;
            const pubs =
              typeof lp.getTrackPublications === "function"
                ? lp.getTrackPublications()
                : Array.from(lp.trackPublications?.values?.() ?? []);
            for (const pub of pubs) {
              try {
                const tr: any = (pub as any).track;
                if (tr && typeof lp.unpublishTrack === "function") lp.unpublishTrack(tr);
              } catch {}
            }
            for (const t of newStream.getTracks()) {
              try {
                await room.localParticipant.publishTrack(t);
              } catch {}
            }
          } catch {}
        }
      } catch (e) {
        console.warn("Camera switch failed:", e);
      }
    });

    const off4 = on("ui:openSettings", () => {
      try {
        window.location.href = "/settings";
      } catch {}
    });

    const off5 = on("ui:like", async () => {
      const room = lkRoomRef.current;
      if (!room) {
        toast("No active connection for like");
        return;
      }
      const newLike = !like;
      setLike(newLike);
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ t: "like", liked: newLike }));
        await (room.localParticipant as any).publishData(payload, { reliable: true, topic: "like" });
      } catch (e) {
        console.warn("publishData failed", e);
      }
      toast(`Like ${newLike ? "❤️" : "💔"}`);
    });

    const off6 = on("ui:report", async () => {
      try {
        toast("Report sent. Moving on");
      } catch {}
      // for future: leave room / switch room here if needed
    });

    const off7 = on("ui:next", () => {
      const now = Date.now();
      if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
      lastNextTsRef.current = now;
      toast("⏭️ Next");
      // later: implement LiveKit-based matchmaking switch
    });

    const off8 = on("ui:prev", () => {
      tryPrevOrRandom();
    });

    const offOpenMsg = on("ui:openMessaging" as any, () => setShowMessaging(true));
    const offCloseMsg = on("ui:closeMessaging" as any, () => setShowMessaging(false));

    const offRemoteAudio = on("ui:toggleRemoteAudio" as any, () => {
      const a = remoteAudioRef.current;
      const v = remoteRef.current;
      const target: any = a ?? v;
      if (target) {
        target.muted = !target.muted;
        toast(target.muted ? "Remote muted" : "Remote unmuted");
      }
    });

    const offTogglePlay = on("ui:togglePlay", () => toast("Toggle matching state"));
    const offToggleMasks = on("ui:toggleMasks", () => toast("Enable/disable masks"));

    const offMirror = on("ui:toggleMirror", () => {
      setIsMirrored((prev) => {
        const s = !prev;
        toast(s ? "Mirror on" : "Mirror off");
        return s;
      });
    });

    const offUpsell = on("ui:upsell", (d: any) => {
      if (ffa) return;
      router.push(`/plans?ref=${d?.ref || d?.feature || "generic"}`);
    });

    // filters events — no server enqueue anymore; keep UX flow only
    const reEnqueue = async () => {
      toast("Filters updated");
    };
    const offCountry = on("filters:country", reEnqueue);
    const offGender = on("filters:gender", reEnqueue);

    // RTC-like UI events (kept for HUD)
    const offRtcPhase = on("rtc:phase" as any, (data) => setRtcPhase(data.phase));
    const offRtcPair = on("rtc:pair" as any, (data) => {
      setPair({ id: data.pairId, role: data.role });
      setPeerInfo((p) => ({ ...p, name: "Partner", likes: Math.floor(Math.random() * 500) }));
    });
    const offRtcTrack = on("rtc:remote-track" as any, (data) => {
      const remoteVideo = remoteRef.current;
      if (remoteVideo && data.stream) {
        remoteVideo.srcObject = data.stream;
        try {
          const remoteAudio = remoteAudioRef.current;
          if (remoteAudio) {
            remoteAudio.srcObject = remoteVideo.srcObject as any;
            remoteAudio.muted = false;
            remoteAudio.play?.().catch(() => {});
          }
        } catch {}
        try { remoteVideo.play?.().catch(() => {}); } catch {}
      }
    });

    if (isBrowser) {
      window.addEventListener("ditona:peer-meta", handlePeerMeta as any);
      window.addEventListener("rtc:peer-like", (e: any) => {
        const detail = e.detail;
        if (detail && typeof detail.liked === "boolean") {
          setPeerLikes(detail.liked ? 1 : 0);
          toast(detail.liked ? "Partner liked you ❤️" : "Partner unliked 💔");
        }
      });
    }

    // init media, then LiveKit connect
    const initMediaWithPermissionChecks = async () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          setCameraPermissionHint("Return to the tab to enable camera");
          return;
        }
        setCameraPermissionHint("");
        await initLocalMedia();
        setCameraPermissionHint("");
      } catch (error: any) {
        console.warn("Media initialization failed:", error);
        if (error?.name === "NotAllowedError") setCameraPermissionHint("Allow camera and microphone from browser settings");
        else if (error?.name === "NotReadableError" || error?.name === "AbortError") setCameraPermissionHint("Close the other tab or allow camera");
        else if (error?.name === "NotFoundError") setCameraPermissionHint("No camera or microphone found");
        else setCameraPermissionHint("Camera access error — check permissions");
        return;
      }

      const s = getLocalStream();
      if (localRef.current && s) {
        if (vip && isBrowser) {
          try {
            const { getVideoEffects } = await import("@/lib/effects");
            const fx = getVideoEffects();
            if (fx) {
              const v = document.createElement("video");
              v.srcObject = s;
              void v.play();
              const processed = await fx.initialize(v);
              if (processed) {
                setEffectsStream(processed);
                localRef.current.srcObject = processed;
                fx.start();
              } else {
                localRef.current.srcObject = s;
              }
            } else {
              localRef.current.srcObject = s;
            }
          } catch {
            localRef.current.srcObject = s;
          }
        } else {
          localRef.current.srcObject = s;
        }

        localRef.current.muted = true;
        localRef.current.play().catch(() => {});

        // connect to LiveKit once
        joinLiveKit().catch((e) => console.warn("joinLiveKit failed", e));
        setReady(true);
      }
    };

    // connect/join room
    const joinLiveKit = async () => {
      if (joiningRef.current) return;
      joiningRef.current = true;

      try {
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        // wire events
        room.on(RoomEvent.TrackSubscribed, (_t: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          try {
            if (pub.kind === Track.Kind.Video) {
              const videoTrack = pub.track;
              if (videoTrack && remoteRef.current) {
                // prefer attaching via media stream for our UI layer
                const ms = new MediaStream([videoTrack.mediaStreamTrack]);
                remoteRef.current.srcObject = ms as any;
                remoteRef.current.play?.().catch(() => {});
                // also dispatch legacy event for HUD
                window.dispatchEvent(new CustomEvent("rtc:remote-track", { detail: { stream: ms } }));
              }
            } else if (pub.kind === Track.Kind.Audio) {
              const audioTrack = pub.track;
              if (audioTrack && remoteAudioRef.current) {
                const ms = new MediaStream([audioTrack.mediaStreamTrack]);
                remoteAudioRef.current.srcObject = ms as any;
                remoteAudioRef.current.muted = false;
                remoteAudioRef.current.play?.().catch(() => {});
              }
            }
            setRtcPhase("connected");
            window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "connected" } }));
          } catch {}
        });

        room.on(RoomEvent.DataReceived, (payload, _participant, _kind, _topic) => {
          try {
            const msg = new TextDecoder().decode(payload);
            if (!msg) return;
            if (/^\s*\{/.test(msg)) {
              const j = JSON.parse(msg);
              if (j?.t === "like") {
                setPeerLikes(j.liked ? 1 : 0);
                toast(j.liked ? "Partner liked you ❤️" : "Partner unliked 💔");
                window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: j }));
              }
              if (j?.t === "peer-meta") {
                window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: j }));
              }
            }
          } catch {}
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          setRtcPhase("searching");
        });

        // set local media tracks into room
        const src = (effectsStream ?? getLocalStream()) || null;
        if (src) {
          for (const t of src.getTracks()) {
            try {
              await room.localParticipant.publishTrack(t);
            } catch {}
          }
        }

        // get token and connect
        const identity =
          (profile && (profile as any)?.displayName && String((profile as any).displayName)) ||
          `anon-${Math.random().toString(36).slice(2, 10)}`;
        const tokenRes = await fetch(`/api/livekit/token?room=ditona-public&identity=${encodeURIComponent(identity)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!tokenRes.ok) {
          console.warn("token fetch failed", tokenRes.status);
          joiningRef.current = false;
          return;
        }
        const { token } = await tokenRes.json();
        const ws = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || "";
        await room.connect(ws, token);

        lkRoomRef.current = room;
        setRtcPhase("matched");
        window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId: "ditona-public", role: "caller" } }));
        window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "matched" } }));
      } finally {
        joiningRef.current = false;
      }
    };

    initMediaWithPermissionChecks().catch(() => {});

    // mobile viewport optimizer
    const mobileOptimizer = getMobileOptimizer();
    const unsubMob = mobileOptimizer.subscribe((vp) => console.log("Viewport changed:", vp));

    return () => {
      off1(); off2(); off3(); off4(); off5(); off6(); off7(); off8();
      offOpenMsg(); offCloseMsg(); offRemoteAudio(); offTogglePlay(); offToggleMasks(); offMirror(); offUpsell();
      offCountry(); offGender(); offRtcPhase(); offRtcPair(); offRtcTrack();
      if (isBrowser) window.removeEventListener("ditona:peer-meta", handlePeerMeta as any);

      // LiveKit cleanup
      try {
        const room = lkRoomRef.current;
        lkRoomRef.current = null;
        if (room) {
          try { room.disconnect(); } catch {}
        }
      } catch {}

      unsubMob();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.id, vip, ffa, router, beauty]);

  // stop-like hook on unmount for legacy rtcFlow parity
  useEffect(() => () => {
    try {
      const room = lkRoomRef.current;
      lkRoomRef.current = null;
      if (room) {
        try { room.disconnect(); } catch {}
      }
    } catch {}
  }, []);

  // swipe next/prev
  useEffect(() => {
    if (!isBrowser) return;
    let x0 = 0, y0 = 0;
    const down = (e: PointerEvent) => { x0 = e.clientX; y0 = e.clientY; };
    const up = (e: PointerEvent) => {
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) { toast("⏭️ Swiped to next"); emit("ui:next"); }
        else {
          if (ffa) console.log("FFA_FORCE: enabled");
          if (!vip && !ffa) { toast("🔒 Going back is VIP only"); emit("ui:upsell", "prev"); }
          else { toast("⏮️ Attempting to go back…"); emit("ui:prev"); }
        }
      }
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); };
  }, [vip, ffa]);

  /* ======================= UI ======================= */

  if (!hydrated) {
    return (
      <div className="min-h-[100dvh] h-[100dvh] w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
        <FilterBar />
        <div className="h-full grid grid-rows-2 gap-2 p-2">
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center text-slate-300/80 text-sm">Loading...</div>
          </section>
          <section className="relative rounded-2xl bg-black/20 overflow-hidden pb-28 md:pb-24">
            <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">Initializing...</div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <>
      <LikeHud />
      <div className="min-h-[100dvh] h-[100dvh] w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100" data-chat-container>
        <div className="h-full grid grid-rows-2 gap-2 p-2">
          {/* ======= remote ======= */}
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <PeerInfoCard peerInfo={peerInfo} />
            <PeerMetadata country={peerInfo.country} city={peerInfo.city} gender={peerInfo.gender} age={peerInfo.age} />
            <FilterBar />
            <MessageHud />

            {/* like button */}
            <div className="absolute bottom-4 right-4 z-30">
              <LikeSystem />
            </div>

            {/* remote media */}
            <video ref={remoteRef} id="remoteVideo" data-role="remote" className="w-full h-full object-cover" playsInline autoPlay />
            <audio ref={remoteAudioRef} id="remoteAudio" autoPlay playsInline hidden />

            {/* searching overlay */}
            {rtcPhase === "searching" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
                <div className="mb-4">Searching for a partner…</div>
                <button
                  onClick={() => toast("🛑 Search cancelled")}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* ======= local ======= */}
          <section className="relative rounded-2xl bg-black/20 overflow-hidden">
            <video
              ref={localRef}
              data-local-video
              className={`w-full h-full object-cover ${isMirrored ? "scale-x-[-1]" : ""}`}
              playsInline
              muted
              autoPlay
            />

            {!ready && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-sm text-center px-4">
                {cameraPermissionHint ? (
                  <>
                    <div className="mb-2 text-yellow-400">⚠️</div>
                    <div className="mb-4">{cameraPermissionHint}</div>
                    <button
                      onClick={() => {
                        setCameraPermissionHint("");
                        initLocalMedia()
                          .then(async () => {
                            const s = getLocalStream();
                            if (localRef.current && s) {
                              if (vip && isBrowser) {
                                try {
                                  const { getVideoEffects } = await import("@/lib/effects");
                                  const fx = getVideoEffects();
                                  if (fx) {
                                    const v = document.createElement("video");
                                    v.srcObject = s;
                                    void v.play();
                                    const processed = await fx.initialize(v);
                                    if (processed) {
                                      setEffectsStream(processed);
                                      localRef.current.srcObject = processed;
                                      fx.start();
                                    } else {
                                      localRef.current.srcObject = s;
                                    }
                                  } else {
                                    localRef.current.srcObject = s;
                                  }
                                } catch {
                                  localRef.current.srcObject = s;
                                }
                              } else {
                                localRef.current.srcObject = s;
                              }
                              localRef.current.muted = true;
                              localRef.current.play().catch(() => {});
                              setReady(true);
                            }
                          })
                          .catch((error) => {
                            console.warn("Retry failed:", error);
                            if ((error as any)?.name === "NotAllowedError") {
                              setCameraPermissionHint("Allow camera and microphone from browser settings");
                            } else if ((error as any)?.name === "NotReadableError" || (error as any)?.name === "AbortError") {
                              setCameraPermissionHint("Close the other tab or allow camera");
                            } else {
                              setCameraPermissionHint("Camera access error — check permissions");
                            }
                          });
                      }}
                      className="px-4 py-2 bg-blue-500/80 hover:bg-blue-600/80 rounded-lg text-white font-medium transition-colors duration-200"
                    >
                      Retry
                    </button>
                  </>
                ) : (
                  <div>Requesting camera/mic…</div>
                )}
              </div>
            )}

            <MyControls />
            <div id="gesture-layer" className="absolute inset-0 -z-10" />
          </section>

          {/* bottom bar + messaging + upsell */}
          <ChatToolbar />
          <UpsellModal open={showUpsell} onClose={() => setShowUpsell(false)} />
          <ChatMessagingBar />
        </div>
      </div>
    </>
  );
}
