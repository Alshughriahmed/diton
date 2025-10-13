"use client";

/* ======================= imports ======================= */
import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";
import { useRouter } from "next/navigation";

import { Room, RoomEvent, Track, LocalVideoTrack } from "livekit-client";

import { useHydrated } from "@/hooks/useHydrated";
import { useNextPrev } from "@/hooks/useNextPrev";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGestures } from "@/hooks/useGestures";

import { initLocalMedia, getLocalStream, toggleMic, toggleCam, switchCamera } from "@/lib/media";
import { getMobileOptimizer } from "@/lib/mobile";
import { useFilters } from "@/state/filters";
import { useFFA } from "@/lib/useFFA";
import { toast } from "@/lib/ui/toast";
import { tryPrevOrRandom } from "@/lib/match/controls";
import { useProfile } from "@/state/profile";

/* ======================= UI components ======================= */
import ChatToolbar from "./components/ChatToolbar";
import ChatMessagingBar from "./components/ChatMessagingBar";
import LikeHud from "./LikeHud";
import FilterBar from "./components/FilterBar";
import MessageHud from "./components/MessageHud";
import MyControls from "@/components/chat/MyControls";
import PeerInfoCard from "@/components/chat/PeerInfoCard";
import PeerMetadata from "@/components/chat/PeerMetadata";

/* ======================= consts / helpers ======================= */
const NEXT_COOLDOWN_MS = 700;
const isBrowser = typeof window !== "undefined";

function getDeviceId(): string {
  if (!isBrowser) return Math.random().toString(36).slice(2);
  let did = localStorage.getItem("ditona_did");
  if (!did) {
    did = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + "-" + Math.random().toString(36).slice(2, 6);
    localStorage.setItem("ditona_did", did);
  }
  return did;
}

function buildIdentity(profile: any) {
  const base = profile?.displayName || profile?.username || profile?.name || "anon";
  const did = getDeviceId().slice(0, 8);
  return `${base}-${did}`;
}

/* ======================= component ======================= */

type RtcPhase = "idle" | "searching" | "matched" | "connected" | "stopped";

export default function ChatClient() {
  const hydrated = useHydrated();
  const { next } = useNextPrev();
  const router = useRouter();
  const ffa = useFFA();
  const { isVip: vip } = useFilters();
  const { profile } = useProfile();

  // refs
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const lkRoomRef = useRef<Room | null>(null);
  const lastNextTsRef = useRef(0);

  // state
  const [rtcPhase, setRtcPhase] = useState<RtcPhase>("idle");
  const [ready, setReady] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
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

  /* ---------- UI hooks ---------- */
  useKeyboardShortcuts();
  useGestures();

  /* ---------- join LiveKit room ---------- */
  useEffect(() => {
    if (!hydrated || !isBrowser) return;

    let cancelled = false;

    const join = async () => {
      try {
        // preview local media
        if (document.visibilityState !== "visible") {
          setCameraPermissionHint("Return to the tab to enable camera");
          return;
        }
        setCameraPermissionHint("");
        const stream = await initLocalMedia();
        if (localRef.current && stream) {
          localRef.current.srcObject = stream;
          localRef.current.muted = true;
          await localRef.current.play().catch(() => {});
        }
        setReady(true);

        // get ephemeral token from our API  (unique identity per device)
        const identity = buildIdentity(profile);
        const tokRes = await fetch(
          `/api/livekit/token?room=ditona-public&identity=${encodeURIComponent(identity)}`,
          { credentials: "include", cache: "no-store" }
        );
        if (!tokRes.ok) {
          console.warn("token fetch failed", tokRes.status);
          return;
        }
        const { token } = await tokRes.json();

        // connect
        const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL!;
        const room = new Room();
        lkRoomRef.current = room;

        setRtcPhase("searching");
        await room.connect(wsUrl, token);

        // publish local camera/mic if not already
        const s = getLocalStream();
        if (s) {
          const v = s.getVideoTracks()[0];
          const a = s.getAudioTracks()[0];
          if (v) await room.localParticipant.publishTrack(v);
          if (a) await room.localParticipant.publishTrack(a);
        }

        /* ---- events ---- */
        room.on(RoomEvent.ParticipantConnected, (p) => {
          setRtcPhase("matched");
          setPeerInfo((prev) => ({ ...prev, name: "Partner", likes: Math.floor(Math.random() * 500) }));
        });

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === "video" && remoteRef.current) {
            // detach old then attach
            try { track.detach(remoteRef.current); } catch {}
            track.attach(remoteRef.current);
            setRtcPhase("connected");
          } else if (track.kind === "audio" && remoteAudioRef.current) {
            try { track.detach(remoteAudioRef.current); } catch {}
            track.attach(remoteAudioRef.current);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          try { track.detach(); } catch {}
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          setRtcPhase("stopped");
        });

        room.on(RoomEvent.Disconnected, () => {
          setRtcPhase("stopped");
        });
      } catch (err: any) {
        console.warn("join failed:", err);
        if (err?.name === "NotAllowedError") setCameraPermissionHint("Allow camera and microphone from browser settings");
        else if (err?.name === "NotReadableError" || err?.name === "AbortError") setCameraPermissionHint("Close the other tab or allow camera");
        else if (err?.name === "NotFoundError") setCameraPermissionHint("No camera or microphone found");
        else setCameraPermissionHint("Camera access error — check permissions");
      }
    };

    join();

    return () => {
      cancelled = true;
      const r = lkRoomRef.current;
      lkRoomRef.current = null;
      try { r?.disconnect(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  /* ---------- UI events ---------- */
  useEffect(() => {
    const off1 = on("ui:toggleMic", () => toggleMic());
    const off2 = on("ui:toggleCam", () => toggleCam());
    const off3 = on("ui:switchCamera", async () => {
      try {
        const newStream = await switchCamera();
        if (localRef.current && newStream) {
          localRef.current.srcObject = newStream;
          localRef.current.muted = true;
          await localRef.current.play().catch(() => {});
        }

        // republish switched camera to LiveKit
        const room = lkRoomRef.current;
        if (room && newStream) {
          try {
            const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
            if (camPub?.track) {
              await room.localParticipant.unpublishTrack(camPub.track);
            }
            const newV = newStream.getVideoTracks()[0];
            if (newV) {
              // publish raw MediaStreamTrack is supported
              await room.localParticipant.publishTrack(newV);
            }
          } catch (e) {
            console.warn("republish camera failed:", e);
          }
        }
      } catch (e) {
        console.warn("Camera switch failed:", e);
      }
    });

    const off4 = on("ui:openMessaging", () => setShowMessaging(true));
    const off5 = on("ui:closeMessaging", () => setShowMessaging(false));

    const off6 = on("ui:toggleRemoteAudio" as any, () => {
      const a = remoteAudioRef.current;
      const v = remoteRef.current;
      const t: any = a ?? v;
      if (t) {
        t.muted = !t.muted;
        toast(t.muted ? "Remote muted" : "Remote unmuted");
      }
    });

    const off7 = on("ui:togglePlay", () => toast("Toggle matching state"));
    const off8 = on("ui:toggleMasks", () => toast("Enable/disable masks"));

    const off9 = on("ui:toggleMirror", () => {
      setIsMirrored((prev) => {
        const s = !prev;
        toast(s ? "Mirror on" : "Mirror off");
        return s;
      });
    });

    const off10 = on("ui:upsell", (d: any) => {
      if (ffa) return;
      router.push(`/plans?ref=${d?.ref || d?.feature || "generic"}`);
    });

    const offNext = on("ui:next", async () => {
      const now = Date.now();
      if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
      lastNextTsRef.current = now;

      // simple next: disconnect then reconnect to room
      try {
        lkRoomRef.current?.disconnect();
      } catch {}
      lkRoomRef.current = null;
      setRtcPhase("idle");
      emit("ui:togglePlay");
      setTimeout(() => window.location.reload(), 100); // أبسط إعادة انضمام
    });

    const offPrev = on("ui:prev", () => {
      tryPrevOrRandom();
    });

    // mobile viewport optimizer
    const mob = getMobileOptimizer();
    const unsubMob = mob.subscribe(() => {});

    return () => {
      off1(); off2(); off3(); off4(); off5(); off6(); off7(); off8(); off9(); off10(); offNext(); offPrev();
      unsubMob();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vip, ffa, router]);

  /* ---------- swipe gestures for next/prev ---------- */
  useEffect(() => {
    if (!isBrowser) return;
    let x0 = 0, y0 = 0;
    const down = (e: PointerEvent) => { x0 = e.clientX; y0 = e.clientY; };
    const up = (e: PointerEvent) => {
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) emit("ui:next");
        else emit("ui:prev");
      }
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); };
  }, []);

  /* ======================= render ======================= */
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
          {/* Top (remote) */}
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <PeerInfoCard peerInfo={peerInfo} />
            <PeerMetadata country={peerInfo.country} city={peerInfo.city} gender={peerInfo.gender} age={peerInfo.age} />
            <FilterBar />
            <MessageHud />

            <div className="absolute bottom-4 right-4 z-30">{/* likes widget placeholder */}</div>

            <video ref={remoteRef} id="remoteVideo" data-role="remote" className="w-full h-full object-cover" playsInline autoPlay />
            <audio ref={remoteAudioRef} id="remoteAudio" autoPlay playsInline hidden />

            {rtcPhase === "searching" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
                <div className="mb-4">Searching for a partner…</div>
                <button
                  onClick={() => { try { lkRoomRef.current?.disconnect(); toast("🛑 Search cancelled"); } catch {} }}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* Bottom (local) */}
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
                              localRef.current.srcObject = s;
                              localRef.current.muted = true;
                              await localRef.current.play().catch(() => {});
                              setReady(true);
                            }
                          })
                          .catch((error) => {
                            console.warn("Retry failed:", error);
                            if ((error as any)?.name === "NotAllowedError")
                              setCameraPermissionHint("Allow camera and microphone from browser settings");
                            else if ((error as any)?.name === "NotReadableError" || (error as any)?.name === "AbortError")
                              setCameraPermissionHint("Close the other tab or allow camera");
                            else setCameraPermissionHint("Camera access error — check permissions");
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

          <ChatToolbar />
          <ChatMessagingBar />
        </div>

        {/* Upsell modal placeholder */}
        {showUpsell && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center" onClick={() => setShowUpsell(false)}>
            <div className="bg-slate-800 rounded-xl p-6">Upgrade</div>
          </div>
        )}
      </div>
    </>
  );
}
