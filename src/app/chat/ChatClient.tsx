"use client";

import { useEffect, useRef, useState } from "react";
lkRoom.localParticipant.publishData(
  new TextEncoder().encode(s),
  { reliable: true } // أو { reliable: true, topic: "like" }
);


import safeFetch from "@/app/chat/safeFetch";
import "@/app/chat/metaInit.client";
import "@/app/chat/peerMetaUi.client";
import "./freeForAllBridge";
import "./dcMetaResponder.client";
import "./likeSyncClient";
import "./msgSendClient";

import { on, emit } from "@/utils/events";
import { useNextPrev } from "@/hooks/useNextPrev";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGestures } from "@/hooks/useGestures";
import { useHydrated } from "@/hooks/useHydrated";
import { getMobileOptimizer } from "@/lib/mobile";
import { toast } from "@/lib/ui/toast";
import { useFilters } from "@/state/filters";
import { useFFA } from "@/lib/useFFA";
import { useRouter } from "next/navigation";
import { tryPrevOrRandom } from "@/lib/match/controls";
import { useProfile } from "@/state/profile";

import {
  initLocalMedia,
  getLocalStream,
  toggleMic,
  toggleCam,
  switchCamera,
} from "@/lib/media";

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

const isBrowser = typeof window !== "undefined";
const NEXT_COOLDOWN_MS = 700;

export default function ChatClient() {
  const ffa = useFFA();
  const router = useRouter();
  const hydrated = useHydrated();
  const { next, prev } = useNextPrev();
  const { isVip: vip } = useFilters();
  const { profile } = useProfile();

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const lastNextTsRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [like, setLike] = useState(false);
  const [peerLikes, setPeerLikes] = useState(0);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraPermissionHint, setCameraPermissionHint] = useState<string>("");

  const [rtcPhase, setRtcPhase] = useState<"idle" | "searching" | "matched" | "connected" | "stopped">("idle");
  const [showMessaging, setShowMessaging] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);

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

  // LiveKit room ref
  const roomRef = useRef<Room | null>(null);

  /* ---------- peer-meta-ui ---------- */
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
        }
      } catch {}
    };
    window.addEventListener("ditona:peer-meta-ui", handler as any);
    return () => window.removeEventListener("ditona:peer-meta-ui", handler as any);
  }, []);

  /* ---------- autostart + LiveKit connect ---------- */
  useEffect(() => {
    if (!hydrated || !isBrowser) return;
    if ((window as any).__ditonaAutostartDone) return;
    (window as any).__ditonaAutostartDone = 1;

    const boot = async () => {
      try {
        setRtcPhase("searching");

        // 1) محلي: كاميرا/مايك لواجهة المستخدم
        const stream = await initLocalMedia().catch(() => null);
        if (stream && localRef.current) {
          localRef.current.srcObject = stream;
          await localRef.current.play().catch(() => {});
        }

        // 2) توكن LiveKit
        const id = `u_${Math.random().toString(36).slice(2, 10)}`;
        const q = new URLSearchParams({ identity: id, room: "ditona-dev" });
        const res = await fetch(`/api/livekit/token?${q}`, { cache: "no-store" });
        if (!res.ok) throw new Error("token fail");
        const { url, token, room } = await res.json();

        // 3) إنشاء الغرفة والاتصال
        const lkRoom = new Room();
        roomRef.current = lkRoom;

        // أحداث الغرفة
        lkRoom
          .on(RoomEvent.Connected, () => {
            setRtcPhase("connected");
          })
          .on(RoomEvent.Disconnected, () => {
            setRtcPhase("stopped");
          })
          .on(RoomEvent.TrackSubscribed, (_track, pub, participant) => {
            if (pub.kind === Track.Kind.Video && remoteRef.current) {
              const el = pub.track?.attach();
              if (el) {
                remoteRef.current.srcObject = el.srcObject ?? remoteRef.current.srcObject;
                // fallback: attach to element directly
                remoteRef.current.srcObject = (pub.track as any)?.mediaStream ?? remoteRef.current.srcObject;
              }
            }
            if (pub.kind === Track.Kind.Audio) {
              pub.track?.attach(); // يفعّل الصوت
            }
          })
          .on(RoomEvent.DataReceived, (payload, _participant, _cid) => {
            try {
              const msg = JSON.parse(new TextDecoder().decode(payload));
              if (msg?.t === "like" && typeof msg.liked === "boolean") {
                setPeerLikes(msg.liked ? 1 : 0);
                toast(msg.liked ? "Partner liked you ❤️" : "Partner unliked 💔");
              }
            } catch {}
          });

        // Tracks محلية للنشر
        let tracks = await createLocalTracks({ audio: true, video: true });
        await lkRoom.connect(url, token);
        for (const t of tracks) await lkRoom.localParticipant.publishTrack(t);

        // بديل لقناة البيانات القديمة
        (globalThis as any).__ditonaDataChannel = {
          readyState: "open",
          send: (s: string) => {
            lkRoom.localParticipant.publishData(
              new TextEncoder().encode(s),
              DataPacket_Kind.RELIABLE
            );
          },
        };

        setReady(true);
      } catch (e) {
        setRtcPhase("idle");
      }
    };

    boot();
  }, [hydrated]);

  /* ---------- UI events ---------- */
  useKeyboardShortcuts();
  useGestures();

  useEffect(() => {
    const off1 = on("ui:toggleMic", () => toggleMic());
    const off2 = on("ui:toggleCam", () => toggleCam());
    const off3 = on("ui:switchCamera", async () => {
      try {
        const newStream = await switchCamera();
        if (localRef.current && newStream) {
          localRef.current.srcObject = newStream;
          localRef.current.play().catch(() => {});
        }
      } catch {}
    });

    const off4 = on("ui:openSettings", () => {
      try { window.location.href = "/settings"; } catch {}
    });

    const off5 = on("ui:like", async () => {
      const dc = (globalThis as any).__ditonaDataChannel;
      if (!dc || dc.readyState !== "open") {
        toast("No active connection for like");
        return;
      }
      const newLike = !like;
      setLike(newLike);
      dc.send(JSON.stringify({ t: "like", liked: newLike }));
      toast(`Like ${newLike ? "❤️" : "💔"}`);
    });

    const off6 = on("ui:report", async () => {
      toast("Report sent. Moving on");
      try { roomRef.current?.disconnect(); } catch {}
      emit("ui:next");
    });

    const off7 = on("ui:next", () => {
      const now = Date.now();
      if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
      lastNextTsRef.current = now;
      // مع LiveKit سنبدّل الغرفة لاحقًا عبر الماتشميكر
      toast("Next requested");
    });

    const off8 = on("ui:prev", () => {
      tryPrevOrRandom();
    });

    const offOpenMsg = on("ui:openMessaging" as any, () => setShowMessaging(true));
    const offCloseMsg = on("ui:closeMessaging" as any, () => setShowMessaging(false));

    const offRemoteAudio = on("ui:toggleRemoteAudio" as any, () => {
      const v = remoteRef.current;
      if (v) {
        v.muted = !v.muted;
        toast(v.muted ? "Remote muted" : "Remote unmuted");
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

    // التنظيف
    const mobileOptimizer = getMobileOptimizer();
    const unsubMob = mobileOptimizer.subscribe(() => {});
    return () => {
      off1(); off2(); off3(); off4(); off5(); off6(); off7(); off8();
      offOpenMsg(); offCloseMsg(); offRemoteAudio(); offTogglePlay(); offToggleMasks(); offMirror(); offUpsell();
      unsubMob();
      try { roomRef.current?.disconnect(); } catch {}
    };
  }, [ffa, router, like]);

  /* ---------- UI ---------- */

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
          {/* remote */}
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <PeerInfoCard peerInfo={peerInfo} />
            <PeerMetadata country={peerInfo.country} city={peerInfo.city} gender={peerInfo.gender} age={peerInfo.age} />
            <FilterBar />
            <MessageHud />
            <div className="absolute bottom-4 right-4 z-30"><LikeSystem /></div>
            <video
              id="remoteVideo"
              ref={remoteRef}
              data-role="remote"
              className="w-full h-full object-cover"
              playsInline
              autoPlay
            />
            <audio id="remoteAudio" autoPlay playsInline hidden />
            {rtcPhase === "searching" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
                <div className="mb-4">Searching for a partner…</div>
                <button
                  onClick={() => { toast("🛑 Search cancelled"); }}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* local */}
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
                      onClick={() => window.location.reload()}
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
