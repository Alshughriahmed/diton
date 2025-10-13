"use client";

/* ======================= boot / guards ======================= */
import "@/app/chat/metaInit.client";
import "@/app/chat/peerMetaUi.client";
import "./freeForAllBridge";
import "./dcMetaResponder.client";
import "./likeSyncClient";
import "./msgSendClient";

/* ======================= react & app hooks ======================= */
import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";

/* livekit */
import { Room, RoomEvent, RemoteParticipant } from "livekit-client";

/* app hooks */
import { useNextPrev } from "@/hooks/useNextPrev";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGestures } from "@/hooks/useGestures";
import { useHydrated } from "@/hooks/useHydrated";

/* media */
import {
  initLocalMedia,
  getLocalStream,
  toggleMic,
  toggleCam,
  switchCamera,
} from "@/lib/media";

/* state + ui libs */
import { useFilters } from "@/state/filters";
import { useFFA } from "@/lib/useFFA";
import { useRouter } from "next/navigation";
import { getMobileOptimizer } from "@/lib/mobile";
import { toast } from "@/lib/ui/toast";
import { tryPrevOrRandom } from "@/lib/match/controls";
import { useProfile } from "@/state/profile";

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
const isBrowser = typeof window !== "undefined";
const WS_URL =
  (process.env.NEXT_PUBLIC_LIVEKIT_WS_URL as string) ||
  (process.env.LIVEKIT_URL as string) ||
  "";

/* ============================================================= */

export default function ChatClient() {
  const ffa = useFFA();
  const router = useRouter();
  const hydrated = useHydrated();
  const { next, prev } = useNextPrev();

  // refs / state
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const lkRoomRef = useRef<Room | null>(null);

  const [ready, setReady] = useState(false);
  const [like, setLike] = useState(false);
  const [peerLikes, setPeerLikes] = useState(0);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraPermissionHint, setCameraPermissionHint] = useState<string>("");

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

  const [remoteCount, setRemoteCount] = useState(0);

  const { isVip: vip } = useFilters();
  const { profile } = useProfile();

  const [beauty, setBeauty] = useState(false);
  const [effectsStream, setEffectsStream] = useState<MediaStream | null>(null);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);

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

  /* ---------- peer-meta-ui from other modules ---------- */
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
        }
      } catch {}
    };
    window.addEventListener("ditona:peer-meta-ui", handler as any);
    return () => window.removeEventListener("ditona:peer-meta-ui", handler as any);
  }, []);

  /* ---------- keyboard + gestures ---------- */
  useKeyboardShortcuts();
  useGestures();

  /* ---------- LiveKit setup ---------- */
  useEffect(() => {
    if (!hydrated || !isBrowser) return;
    if (!WS_URL) {
      console.warn("LIVEKIT WS URL missing");
      return;
    }

    let stopped = false;

    const join = async () => {
      try {
        // init local media to show preview
        await initLocalMedia();
        const s = getLocalStream();
        if (localRef.current && s) {
          localRef.current.srcObject = s;
          localRef.current.muted = true;
          localRef.current.play?.().catch(() => {});
        }

        // get ephemeral token from our API
        const identity =
          (profile?.name && String(profile.name)) ||
          `anon-${Math.random().toString(36).slice(2, 10)}`;
        const tokenRes = await fetch(`/api/livekit/token?room=ditona-public&identity=${encodeURIComponent(identity)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!tokenRes.ok) {
          console.warn("token fetch failed", tokenRes.status);
          return;
        }
        const { token } = await tokenRes.json();

        // create room and connect
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        lkRoomRef.current = room;

        // wire room events
        room
          .on(RoomEvent.ParticipantConnected, () => {
            setRemoteCount(room.remoteParticipants.size);
          })
          .on(RoomEvent.ParticipantDisconnected, () => {
            setRemoteCount(room.remoteParticipants.size);
          })
          .on(RoomEvent.TrackSubscribed, (_track, _pub, participant) => {
            if (participant.isLocal) return;
            // render remote
            const rv = remoteRef.current;
            if (rv) {
              // room SDK auto attaches via track.attach(), لكن نسهّل بربط stream مباشرة لو وصل
              const ms = new MediaStream();
              participant.tracks.forEach((pub) => {
                const t = pub.track as MediaStreamTrack | null;
                if (t) ms.addTrack(t);
              });
              rv.srcObject = ms;
              rv.muted = false;
              rv.play?.().catch(() => {});
              const ra = remoteAudioRef.current;
              if (ra) {
                ra.srcObject = ms;
                ra.muted = false;
                ra.play?.().catch(() => {});
              }
            }
            setRemoteCount(room.remoteParticipants.size);
          })
          .on(RoomEvent.TrackUnsubscribed, () => {
            setRemoteCount(room.remoteParticipants.size);
          })
          .on(RoomEvent.DataReceived, (payload, _participant: RemoteParticipant | undefined, _kind, topic) => {
            if (topic !== "like") return;
            try {
              const msg = JSON.parse(new TextDecoder().decode(payload));
              if (msg?.t === "like" && typeof msg.liked === "boolean") {
                window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked: msg.liked } }));
              }
            } catch {}
          });

        await room.connect(WS_URL, token);

        // publish local tracks from our preview stream
        if (s) {
          for (const t of s.getTracks()) {
            try {
              await room.localParticipant.publishTrack(t);
            } catch {}
          }
        }

        setReady(true);
      } catch (err: any) {
        console.warn("livekit join error", err);
        if (err?.name === "NotAllowedError") setCameraPermissionHint("Allow camera and microphone from browser settings");
        else if (err?.name === "NotReadableError" || err?.name === "AbortError") setCameraPermissionHint("Close the other tab or allow camera");
        else if (err?.name === "NotFoundError") setCameraPermissionHint("No camera or microphone found");
        else setCameraPermissionHint("Camera access error — check permissions");
      }
    };

    join();

    return () => {
      stopped = true;
      const r = lkRoomRef.current;
      lkRoomRef.current = null;
      try {
        r?.disconnect();
      } catch {}
    };
  }, [hydrated]);

  /* ---------- UI event bus ---------- */
  useEffect(() => {
    const off1 = on("ui:toggleMic", () => toggleMic());
    const off2 = on("ui:toggleCam", () => toggleCam());
    const off3 = on("ui:switchCamera", async () => {
      try {
        const newStream = await switchCamera();
        if (localRef.current && newStream) {
          localRef.current.srcObject = newStream;
          localRef.current.play().catch(() => {});
          // republish switched tracks
          const room = lkRoomRef.current;
          if (room) {
            for (const pub of room.localParticipant.tracks.values()) {
              try {
                pub.unpublish();
              } catch {}
            }
            for (const t of newStream.getTracks()) {
              try {
                await room.localParticipant.publishTrack(t);
              } catch {}
            }
          }
        }
      } catch (e) {
        console.warn("Camera switch failed:", e);
      }
    });

    const offOpenMsg = on("ui:openMessaging" as any, () => setShowMessaging(true));
    const offCloseMsg = on("ui:closeMessaging" as any, () => setShowMessaging(false));

    const offRemoteAudio = on("ui:toggleRemoteAudio" as any, () => {
      const a = remoteAudioRef.current;
      const v = remoteRef.current;
      const target = a ?? v;
      if (target) {
        // @ts-ignore
        target.muted = !target.muted;
        // @ts-ignore
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

    // like via LiveKit data channel
    const offLike = on("ui:like", async () => {
      const room = lkRoomRef.current;
      if (!room) {
        toast("No active connection for like");
        return;
      }
      const newLike = !like;
      setLike(newLike);
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ t: "like", liked: newLike }));
        // use reliable data with topic "like"
        // recent SDKs expect options object
        // @ts-ignore types vary by SDK version
        await room.localParticipant.publishData(payload, { reliable: true, topic: "like" });
      } catch (e) {
        console.warn("publishData failed", e);
      }
      toast(`Like ${newLike ? "❤️" : "💔"}`);
    });

    // peer-like -> HUD
    if (isBrowser) {
      window.addEventListener("rtc:peer-like", (e: any) => {
        const detail = e.detail;
        if (detail && typeof detail.liked === "boolean") {
          setPeerLikes(detail.liked ? 1 : 0);
          toast(detail.liked ? "Partner liked you ❤️" : "Partner unliked 💔");
        }
      });
    }

    // beauty / masks config
    const offBeauty = on("ui:toggleBeauty", async (data) => {
      try {
        if (!isBrowser) return;
        const { getVideoEffects } = await import("@/lib/effects");
        const fx = getVideoEffects();
        if (fx) {
          fx.updateConfig({ beauty: { enabled: data.enabled, ...(data.settings || {}) } });
          setBeauty(!!data.enabled);
        }
      } catch {}
    });

    const offBeautyUpdate = on("ui:updateBeauty", async (data) => {
      try {
        if (!isBrowser) return;
        const { getVideoEffects } = await import("@/lib/effects");
        const fx = getVideoEffects();
        if (fx) fx.updateConfig({ beauty: { enabled: beauty, ...(data.settings || {}) } });
      } catch {}
    });

    const offMask = on("ui:changeMask", async (data) => {
      try {
        if (!isBrowser) return;
        const { getVideoEffects } = await import("@/lib/effects");
        const fx = getVideoEffects();
        if (fx) fx.updateConfig({ mask: { enabled: data.type !== "none", type: data.type } });
      } catch {}
    });

    return () => {
      off1(); off2(); off3();
      offOpenMsg(); offCloseMsg(); offRemoteAudio(); offTogglePlay(); offToggleMasks(); offMirror(); offUpsell();
      offLike(); offBeauty(); offBeautyUpdate(); offMask();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [like, vip, ffa, router, beauty]);

  /* ---------- mobile viewport optimizer ---------- */
  useEffect(() => {
    const mobileOptimizer = getMobileOptimizer();
    const unsubMob = mobileOptimizer.subscribe((vp) => console.log("Viewport changed:", vp));
    return () => unsubMob();
  }, []);

  /* ---------- swipe next/prev: UI only ---------- */
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

  /* ---------- render ---------- */
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
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <PeerInfoCard peerInfo={peerInfo} />
            <PeerMetadata country={peerInfo.country} city={peerInfo.city} gender={peerInfo.gender} age={peerInfo.age} />
            <FilterBar />
            <MessageHud />
            <div className="absolute bottom-4 right-4 z-30"><LikeSystem /></div>

            <video ref={remoteRef} id="remoteVideo" data-role="remote" className="w-full h-full object-cover" playsInline autoPlay />
            <audio ref={remoteAudioRef} id="remoteAudio" autoPlay playsInline hidden />

            {remoteCount === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
                <div className="mb-4">Searching for a partner…</div>
                <button
                  onClick={() => {
                    try { lkRoomRef.current?.disconnect(); } catch {}
                    toast("🛑 Search cancelled");
                  }}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

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
                      onClick={async () => {
                        setCameraPermissionHint("");
                        try {
                          await initLocalMedia();
                          const s = getLocalStream();
                          if (localRef.current && s) {
                            localRef.current.srcObject = s;
                            localRef.current.muted = true;
                            await localRef.current.play().catch(() => {});
                            setReady(true);
                          }
                        } catch (error: any) {
                          if (error?.name === "NotAllowedError") setCameraPermissionHint("Allow camera and microphone from browser settings");
                          else if (error?.name === "NotReadableError" || error?.name === "AbortError") setCameraPermissionHint("Close the other tab or allow camera");
                          else setCameraPermissionHint("Camera access error — check permissions");
                        }
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

          <ChatToolbar />
          <UpsellModal open={showUpsell} onClose={() => setShowUpsell(false)} />
          <ChatMessagingBar />
        </div>
      </div>
    </>
  );
}
