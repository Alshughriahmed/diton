"use client";

import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Track,
  createLocalTracks,
} from "livekit-client";

import { on, emit } from "@/utils/events";
import { toast } from "@/lib/ui/toast";
import { useHydrated } from "@/hooks/useHydrated";
import { useFFA } from "@/lib/useFFA";
import { useFilters } from "@/state/filters";
import { useRouter } from "next/navigation";

import {
  toggleMic,
  toggleCam,
  switchCamera,
  initLocalMedia,
  getLocalStream,
} from "@/lib/media";

import { useProfile } from "@/state/profile";
import { getMobileOptimizer } from "@/lib/mobile";
import { tryPrevOrRandom } from "@/lib/match/controls";

/* UI */
import PeerInfoCard from "@/components/chat/PeerInfoCard";
import PeerMetadata from "@/components/chat/PeerMetadata";
import LikeSystem from "@/components/chat/LikeSystem";
import LikeHud from "./LikeHud";
import ChatToolbar from "./components/ChatToolbar";
import ChatMessagingBar from "./components/ChatMessagingBar";
import MessageHud from "./components/MessageHud";
import FilterBar from "./components/FilterBar";
import MyControls from "@/components/chat/MyControls";

const isBrowser = typeof window !== "undefined";

export default function ChatClient() {
  const hydrated = useHydrated();
  const router = useRouter();
  const ffa = useFFA();
  const { isVip: vip } = useFilters();
  const { profile } = useProfile();

  // media
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  // livekit room ref
  const roomRef = useRef<Room | null>(null);

  // ui state
  const [ready, setReady] = useState(false);
  const [rtcPhase, setRtcPhase] = useState<
    "idle" | "searching" | "matched" | "connected" | "stopped"
  >("idle");
  const [cameraPermissionHint, setCameraPermissionHint] = useState("");
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
  const [isMirrored, setIsMirrored] = useState(true);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [peerLikes, setPeerLikes] = useState(0);
  const [like, setLike] = useState(false);

  /* -------- helpers -------- */
  function attachRemote(track: RemoteTrack | null) {
    const v = remoteRef.current;
    if (!v || !track) return;
    if (track.kind === Track.Kind.Video) {
      track.attach(v);
      v.play?.().catch(() => {});
    }
  }

  function detachRemote() {
    const v = remoteRef.current;
    if (!v) return;
    try {
      v.srcObject = null;
      v.pause?.();
    } catch {}
  }

  async function connectLiveKit() {
    if (!isBrowser) return;

    // اطلب توكن + WS URL من الراوت
    const identity = crypto.randomUUID();
    const res = await fetch(
      `/api/livekit/token?room=ditona-public&identity=${encodeURIComponent(
        identity
      )}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("token endpoint failed");
    const { token, wsUrl } = await res.json();

    // أنشئ الغرفة واتصل
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    room
      .on(RoomEvent.TrackSubscribed, (_track, publication, participant) => {
        // فيديو الطرف الآخر
        if (publication?.track?.kind === Track.Kind.Video) {
          attachRemote(publication.track as RemoteTrack);
          setRtcPhase("connected");
        }
      })
      .on(RoomEvent.TrackUnsubscribed, () => {
        detachRemote();
      })
      .on(RoomEvent.DataReceived, (payload, participant, topic) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg?.t === "like") {
            setPeerLikes(msg.liked ? 1 : 0);
            toast(msg.liked ? "Partner liked you ❤️" : "Partner unliked 💔");
          }
        } catch {}
      })
      .on(RoomEvent.Connected, () => {
        setRtcPhase("matched");
      })
      .on(RoomEvent.Disconnected, () => {
        setRtcPhase("stopped");
      });

    await room.connect(wsUrl, token);

    // نشر المسارات المحلية
    const tracks = await createLocalTracks({ audio: true, video: true });
    for (const t of tracks) await room.localParticipant.publishTrack(t);

    // عرض المحلي
    if (localRef.current) {
      const s = new MediaStream(
        tracks.filter((t) => t.kind === Track.Kind.Video).map((t) => t.mediaStreamTrack)
      );
      localRef.current.srcObject = s;
      localRef.current.muted = true;
      localRef.current.play().catch(() => {});
    }

    roomRef.current = room;
    setRtcPhase("searching"); // حتى يصل فيديو الطرف الآخر
    setReady(true);
  }

  async function disconnectLiveKit() {
    try {
      await roomRef.current?.disconnect();
    } catch {}
    roomRef.current = null;
    detachRemote();
    setRtcPhase("stopped");
  }

  /* -------- mount -------- */
  useEffect(() => {
    if (!hydrated) return;

    // تهيئة الميديا أولاً لرسالة إذن واضحة
    (async () => {
      try {
        await initLocalMedia();
      } catch (error: any) {
        if (error?.name === "NotAllowedError")
          setCameraPermissionHint("Allow camera and microphone from browser settings");
        else if (error?.name === "NotReadableError" || error?.name === "AbortError")
          setCameraPermissionHint("Close the other tab or allow camera");
        else if (error?.name === "NotFoundError")
          setCameraPermissionHint("No camera or microphone found");
        else setCameraPermissionHint("Camera access error — check permissions");
      }
      await connectLiveKit().catch((e) => {
        console.warn("livekit connect failed", e);
        toast("Connection failed");
      });
    })();

    const mobileOptimizer = getMobileOptimizer();
    const unsubMob = mobileOptimizer.subscribe(() => {});

    return () => {
      unsubMob();
      disconnectLiveKit();
    };
  }, [hydrated]);

  /* -------- UI events / likes / controls -------- */
  useEffect(() => {
    const offLike = on("ui:like", () => {
      const room = roomRef.current;
      if (!room) return;
      const newLike = !like;
      setLike(newLike);
      const payload = new TextEncoder().encode(
        JSON.stringify({ t: "like", liked: newLike })
      );
      // النوع الصحيح: DataPublishOptions
      room.localParticipant.publishData(payload, { reliable: true });
      toast(newLike ? "❤️ Liked" : "💔 Unliked");
    });

    const offNext = on("ui:next", async () => {
      // بسيط: إعادة الاتصال بنفس الغرفة لتبديل الشريك عند توفره
      await disconnectLiveKit();
      await connectLiveKit();
    });

    const offPrev = on("ui:prev", async () => {
      await disconnectLiveKit();
      await connectLiveKit();
    });

    const offMic = on("ui:toggleMic", () => toggleMic());
    const offCam = on("ui:toggleCam", () => toggleCam());
    const offSwitch = on("ui:switchCamera", () => switchCamera());
    const offMirror = on("ui:toggleMirror", () =>
      setIsMirrored((p) => !p)
    );

    return () => {
      offLike();
      offNext();
      offPrev();
      offMic();
      offCam();
      offSwitch();
      offMirror();
    };
  }, [like]);

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
          {/* Remote */}
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
                  onClick={() => {
                    disconnectLiveKit().then(() => toast("🛑 Search cancelled"));
                  }}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* Local */}
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
                {cameraPermissionHint || "Requesting camera/mic…"}
              </div>
            )}
            <MyControls />
            <div id="gesture-layer" className="absolute inset-0 -z-10" />
          </section>

          <ChatToolbar />
          <ChatMessagingBar />
        </div>
      </div>
    </>
  );
}
