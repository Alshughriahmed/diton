"use client";

/**
 * ChatClient.tsx — LiveKit-only + Redis match
 * Session-locked (sid) join/leave to eliminate races.
 * No /api/rtc/* calls. Keeps existing UI components & events.
 *
 * Guarantees:
 * - One active session at a time (sid guard).
 * - No auto-rejoin; Next/Prev is the only driver.
 * - Local preview persists; no track.stop() on Next/Prev.
 * - DataChannel: use global shim window.__ditonaDataChannel via attach/detach.
 */

// 1) Load DC shim first
import "@/app/chat/dcShim.client";

// 2) Side-effect modules (HUD / DC consumers) — do not remove
import "@/app/chat/metaInit.client";
import "@/app/chat/peerMetaUi.client";
import "./freeForAllBridge";
import "./dcMetaResponder.client";
import "./likeSyncClient";
import "./msgSendClient";

// 3) React + app hooks
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

// 4) LiveKit
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  Track,
  RemoteTrack,
  ConnectionState,
} from "livekit-client";

// 5) UI components (keep UI intact; avoid missing imports)
import LikeSystem from "@/components/chat/LikeSystem";
// NOTE: PeerInfoCard is not guaranteed to exist in this tree; avoid import to keep TS green.
// import PeerInfoCard from "@/components/chat/PeerInfoCard";
// import PeerMetadata from "@/components/chat/PeerMetadata";
import MyControls from "@/components/chat/MyControls";
import UpsellModal from "@/components/chat/UpsellModal";
import ChatToolbar from "./components/ChatToolbar";
import ChatMessagingBar from "./components/ChatMessagingBar";
import MessageHud from "./components/MessageHud";
import FilterBar from "./components/FilterBar";
import LikeHud from "./LikeHud";

// 6) Types / consts
type Phase = "boot" | "idle" | "searching" | "matched" | "connected" | "stopped";
const NEXT_COOLDOWN_MS = 700;
const DISCONNECT_TIMEOUT_MS = 900; // compact but safe
const isBrowser = typeof window !== "undefined";

export default function ChatClient() {
  // ======= app hooks =======
  const ffa = useFFA();
  const router = useRouter();
  const hydrated = useHydrated();
  const { next, prev } = useNextPrev();
  useKeyboardShortcuts();
  useGestures();

  // ======= DOM refs =======
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // ======= state =======
  const [ready, setReady] = useState(false);
  const [like, setLike] = useState(false);
  const [peerLikes, setPeerLikes] = useState(0);
  const [rtcPhase, setRtcPhase] = useState<Phase>("idle");
  const [showMessaging, setShowMessaging] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraPermissionHint, setCameraPermissionHint] = useState<string>("");
  const [effectsStream, setEffectsStream] = useState<MediaStream | null>(null);
  const { isVip: vip, gender, countries } = useFilters();
  const { profile } = useProfile();
  const lastNextTsRef = useRef(0);

  // ======= LiveKit room & guards =======
  const roomRef = useRef<Room | null>(null);
  const roomUnsubsRef = useRef<(() => void)[]>([]);
  const joiningRef = useRef(false);
  const leavingRef = useRef(false);

  // ======= session lock (sid) =======
  const sidRef = useRef(0);
  function newSid(): number {
    sidRef.current += 1;
    return sidRef.current;
  }
  function isActiveSid(sid: number): boolean {
    return sid === sidRef.current;
  }

  // ======= stable identity =======
  function stableDid(): string {
    try {
      const k = "ditona_did";
      const v = localStorage.getItem(k);
      if (typeof v === "string" && v.length > 0) return v;
      const gen = crypto?.randomUUID?.() || ("did-" + Math.random().toString(36).slice(2, 10));
      localStorage.setItem(k, gen);
      return String(gen);
    } catch {
      return "did-" + Math.random().toString(36).slice(2, 10);
    }
  }
  function identity(): string {
    const base = String((profile?.displayName || "anon")).trim() || "anon";
    const did = String(stableDid());
    const tail = did.length >= 6 ? did.slice(0, 6) : ("000000" + did).slice(-6);
    return `${base}#${tail}`;
  }

  // ======= REST helpers (all no-store, include credentials) =======
  async function enqueueReq(b: any): Promise<string> {
    const r = await fetch("/api/match/enqueue", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(b),
    });
    if (!r.ok) throw new Error("enqueue failed " + r.status);
    const j = await r.json();
    return String(j.ticket || "");
  }
  async function nextReq(ticket: string, waitMs = 8000): Promise<string | null> {
    const r = await fetch(`/api/match/next?ticket=${encodeURIComponent(ticket)}&wait=${waitMs}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (r.status === 204) return null;
    if (!r.ok) throw new Error("next failed " + r.status);
    const j = await r.json();
    const raw = j?.room;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object")
      return String(raw.name || raw.id || raw.room || JSON.stringify(raw));
    return null;
  }
  async function tokenReq(room: string, id: string): Promise<string> {
    const r = await fetch(
      `/api/livekit/token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(id)}`,
      { method: "GET", credentials: "include", cache: "no-store" }
    );
    if (!r.ok) throw new Error("token failed " + r.status);
    const j = await r.json();
    return String(j.token || "");
  }

  // ======= window events helpers =======
  function setPhase(p: Phase) {
    setRtcPhase(p);
    try {
      window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: p } }));
    } catch {}
  }
  function emitPair(pairId: string, role: "caller" | "callee") {
    try {
      window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId, role } }));
    } catch {}
  }
  function emitRemoteTrack(stream: MediaStream) {
    try {
      window.dispatchEvent(new CustomEvent("rtc:remote-track", { detail: { stream } }));
    } catch {}
  }

  // ======= DC shim helpers =======
  function dcAttach(room: Room) {
    const dc: any = (globalThis as any).__ditonaDataChannel;
    try { dc?.attach?.(room); } catch {}
    try { dc?.setConnected?.(true); } catch {}
  }
  function dcDetach() {
    const dc: any = (globalThis as any).__ditonaDataChannel;
    try { dc?.setConnected?.(false); } catch {}
    try { dc?.detach?.(); } catch {}
  }

  // ======= cleanup helpers =======
  function clearRemoteMedia() {
    try {
      if (remoteRef.current) remoteRef.current.srcObject = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    } catch {}
  }
  function restoreLocalPreview() {
    const s = getLocalStream();
    if (localRef.current && s) {
      localRef.current.srcObject = s;
      localRef.current.muted = true;
      localRef.current.play?.().catch(() => {});
    }
  }
  function clearRoomListeners() {
    for (const off of roomUnsubsRef.current.splice(0)) {
      try { off(); } catch {}
    }
  }

  async function leaveRoom(): Promise<void> {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const room = roomRef.current;
    roomRef.current = null;

    // Detach DC and clear listeners BEFORE disconnect to avoid late callbacks
    dcDetach();
    clearRoomListeners();

    // Clear remote DOM immediately
    clearRemoteMedia();

    // Keep local preview alive (no track.stop())
    restoreLocalPreview();

    if (room) {
      try {
        // Unpublish but DO NOT stop local tracks
        const lp: any = room.localParticipant;
        const pubs =
          typeof lp.getTrackPublications === "function"
            ? lp.getTrackPublications()
            : Array.from(lp.trackPublications?.values?.() ?? []);
        for (const pub of pubs) {
          try {
            const tr: any = (pub as any).track;
            if (tr && typeof lp.unpublishTrack === "function") {
              await lp.unpublishTrack(tr, { stop: false });
            }
          } catch {}
        }
      } catch {}

      // Wait for Disconnected or timeout
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          try { room.off(RoomEvent.Disconnected, finish); } catch {}
          resolve();
        };
        try { room.on(RoomEvent.Disconnected, finish); } catch {}
        try { room.disconnect(false); } catch { finish(); }
        setTimeout(finish, DISCONNECT_TIMEOUT_MS);
      });
    }

    (globalThis as any).__lkRoom = null;
    leavingRef.current = false;
    setPhase("stopped");
  }

  // ======= LiveKit event wiring (per-room, sid-guarded) =======
  function wireRoomEvents(room: Room, roomName: string, sid: number) {
    const onTrack = (_t: RemoteTrack, pub: RemoteTrackPublication, _p: RemoteParticipant) => {
      if (!isActiveSid(sid)) return;
      try {
        if (pub.kind === Track.Kind.Video) {
          const vt = pub.track;
          if (vt && remoteRef.current) {
            const ms = new MediaStream([vt.mediaStreamTrack]);
            remoteRef.current.srcObject = ms as any;
            remoteRef.current.play?.().catch(() => {});
            emitRemoteTrack(ms);
          }
        } else if (pub.kind === Track.Kind.Audio) {
          const at = pub.track;
          if (at && remoteAudioRef.current) {
            const ms = new MediaStream([at.mediaStreamTrack]);
            remoteAudioRef.current.srcObject = ms as any;
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play?.().catch(() => {});
          }
        }
        setPhase("connected");
      } catch {}
    };
    room.on(RoomEvent.TrackSubscribed, onTrack);
    roomUnsubsRef.current.push(() => { try { room.off(RoomEvent.TrackSubscribed, onTrack); } catch {} });

    const onTrackUnsub = (_t: RemoteTrack, pub: RemoteTrackPublication) => {
      if (!isActiveSid(sid)) return;
      try {
        if (pub.kind === Track.Kind.Video && remoteRef.current) remoteRef.current.srcObject = null;
        if (pub.kind === Track.Kind.Audio && remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      } catch {}
    };
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsub);
    roomUnsubsRef.current.push(() => { try { room.off(RoomEvent.TrackUnsubscribed, onTrackUnsub); } catch {} });

    const onConn = (state: ConnectionState) => {
      if (!isActiveSid(sid)) return;
      if (state === "reconnecting") {
        setPhase("searching");
      } else if (state === "connected") {
        setPhase("connected");
        // attempt autoplay again
        try { remoteRef.current?.play?.(); } catch {}
        try { remoteAudioRef.current?.play?.(); } catch {}
      }
      // no auto-join on disconnected — controlled via Next/Prev only
    };
    room.on(RoomEvent.ConnectionStateChanged, onConn);
    roomUnsubsRef.current.push(() => { try { room.off(RoomEvent.ConnectionStateChanged, onConn); } catch {} });

    const onData = (payload: Uint8Array) => {
      if (!isActiveSid(sid)) return;
      try {
        const txt = new TextDecoder().decode(payload);
        if (!txt || !/^\s*\{/.test(txt)) return;
        const j = JSON.parse(txt);
        if (j?.t === "chat" && j.text) {
          window.dispatchEvent(new CustomEvent("ditona:chat:recv", { detail: { text: j.text, pairId: roomName } }));
        }
        if (j?.t === "peer-meta" && j.payload) {
          window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: j.payload }));
        }
        if (j?.t === "like" || j?.type === "like:toggled") {
          window.dispatchEvent(new CustomEvent("ditona:like:recv", { detail: { pairId: roomName } }));
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, onData);
    roomUnsubsRef.current.push(() => { try { room.off(RoomEvent.DataReceived, onData); } catch {} });

    const onPart = () => {
      if (!isActiveSid(sid)) return;
      // inform HUD only; do NOT auto-rejoin here
      setPhase("searching");
    };
    room.on(RoomEvent.ParticipantDisconnected, onPart);
    roomUnsubsRef.current.push(() => { try { room.off(RoomEvent.ParticipantDisconnected, onPart); } catch {} });

    const onDisc = () => {
      if (!isActiveSid(sid)) return;
      dcDetach();
      setPhase("stopped");
    };
    room.on(RoomEvent.Disconnected, onDisc);
    roomUnsubsRef.current.push(() => { try { room.off(RoomEvent.Disconnected, onDisc); } catch {} });
  }

  // ======= matching + join (sid-guarded) =======
  async function joinViaRedisMatch(sid: number): Promise<void> {
    if (!isActiveSid(sid) || joiningRef.current || leavingRef.current) return;
    if (roomRef.current?.state === "connecting") return;
    joiningRef.current = true;
    setPhase("searching");

    try {
      // 0) Normalize filters
      let selfCountry: string | null = null;
      try {
        const g = JSON.parse(localStorage.getItem("ditona_geo") || "null");
        if (g?.country) selfCountry = String(g.country).toUpperCase();
      } catch {}
      const gFilter = (gender === "male" || gender === "female") ? [gender] : [];

      // 1) enqueue
      const ticket = await enqueueReq({
        identity: identity(),
        deviceId: stableDid(),
        vip: !!vip,
        selfGender: profile?.gender === "male" || profile?.gender === "female" ? profile.gender : "u",
        selfCountry,
        filterGenders: gFilter,
        filterCountries: Array.isArray(countries) ? countries : [],
      });
      if (!isActiveSid(sid)) return;

      // 2) next (long-poll up to 8s; 2 attempts)
      let roomName: string | null = null;
      for (let i = 0; i < 2 && !roomName; i++) {
        roomName = await nextReq(ticket, 8000);
        if (!isActiveSid(sid)) return;
      }
      if (!roomName) {
        setPhase("stopped");
        return;
      }

      // 3) create room and wire events BEFORE connect
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      wireRoomEvents(room, roomName, sid);

      // 4) token & connect
      const id = identity();
      const token = await tokenReq(roomName, id);
      if (!isActiveSid(sid)) return;
      const ws = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || "";
      // Clear remote refs before connect
      clearRemoteMedia();
      setPhase("matched");
      emitPair(roomName, "caller");
      await room.connect(ws, token);
      if (!isActiveSid(sid)) { try { await room.disconnect(false); } catch {} return; }

      // 5) attach DC shim
      dcAttach(room);
      (globalThis as any).__lkRoom = room;

      // 6) (re)publish local tracks AFTER connected
      const src = (effectsStream ?? getLocalStream()) || null;
      if (src && room.state === "connected") {
        for (const t of src.getTracks()) {
          if (!isActiveSid(sid)) break;
          try { await room.localParticipant.publishTrack(t); } catch {}
        }
      }
    } catch (e) {
      console.warn("joinViaRedisMatch failed", e);
    } finally {
      joiningRef.current = false;
    }
  }

  // ======= UI wiring =======
  useEffect(() => {
    if (!hydrated || !isBrowser) return;

    // boot: init local media and start first session
    const boot = async () => {
      setPhase("boot");
      try {
        await initLocalMedia();
        const s = getLocalStream();
        if (localRef.current && s) {
          localRef.current.srcObject = s;
          localRef.current.muted = true;
          await localRef.current.play().catch(() => {});
        }
        setReady(true);

        const sid = newSid();
        await joinViaRedisMatch(sid);
      } catch (error: any) {
        console.warn("Media init failed:", error);
        if (error?.name === "NotAllowedError")
          setCameraPermissionHint("Allow camera and microphone from browser settings");
        else if (error?.name === "NotReadableError" || error?.name === "AbortError")
          setCameraPermissionHint("Close other apps/tabs using the camera");
        else if (error?.name === "NotFoundError")
          setCameraPermissionHint("No camera or microphone found");
        else
          setCameraPermissionHint("Camera access error — check permissions");
      }
    };
    boot().catch(()=>{});

   // UI event bus
const off1 = on("ui:toggleMic", () => toggleMic());
const off2 = on("ui:toggleCam", () => toggleCam());
const off3 = on("ui:switchCamera", async () => {
  try {
    const newStream = await switchCamera();
    if (localRef.current && newStream) {
      localRef.current.srcObject = newStream;
      localRef.current.play().catch(() => {});
    }
    const room = roomRef.current;
    if (room && room.state === "connected") {
      // Unpublish previous video tracks only, keep audio
      const pubs =
        typeof room.localParticipant.getTrackPublications === "function"
          ? room.localParticipant.getTrackPublications()
          : Array.from(
              (room.localParticipant as any).trackPublications?.values?.() ?? []
            );

      for (const pub of pubs as any[]) {
        const kind = pub?.kind ?? pub?.track?.kind;
        const tr = pub?.track;
        if (kind === Track.Kind.Video || pub?.source === "camera") {
          try {
            await room.localParticipant.unpublishTrack(tr, { stop: false });
          } catch {}
        }
      }

      // Publish the new camera track
      const nv = newStream.getVideoTracks()[0];
      if (nv) {
        try {
          await room.localParticipant.publishTrack(nv);
        } catch {}
      }
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
  const room = roomRef.current;
  if (!room || room.state !== "connected") {
    toast("No active connection for like");
    return;
  }
  const newLike = !like;
  setLike(newLike);
  try {
    const payload = new TextEncoder().encode(
      JSON.stringify({ t: "like", liked: newLike })
    );
    await (room.localParticipant as any).publishData(payload, {
      reliable: true,
      topic: "like",
    });
  } catch (e) {
    console.warn("publishData failed", e);
  }
  toast(`Like ${newLike ? "❤️" : "💔"}`);
});
const off6 = on("ui:report", async () => {
  toast("Report sent. Moving on");
});

const off7 = on("ui:next", async () => {
  const now = Date.now();
  if (
    joiningRef.current ||
    leavingRef.current ||
    roomRef.current?.state === "connecting"
  )
    return;
  if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
  lastNextTsRef.current = now;
  toast("⏭️ Next");
  const sid = newSid(); // invalidate any in-flight work
  await leaveRoom(); // cleanly detach old room
  await new Promise((r) => setTimeout(r, 120)); // short cool-down
  await joinViaRedisMatch(sid);
});

const off8 = on("ui:prev", () => {
  if (ffa) console.log("FFA_FORCE: enabled");
  if (!vip && !ffa) {
    toast("🔒 Going back is VIP only");
    emit("ui:upsell", "prev");
  } else {
    toast("⏮️ Attempting to go back…");
    tryPrevOrRandom();
  }
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
      setIsMirrored(prev => { const s = !prev; toast(s ? "Mirror on" : "Mirror off"); return s; });
    });
    const offUpsell = on("ui:upsell", (d: any) => { if (ffa) return; router.push(`/plans?ref=${d?.ref || d?.feature || "generic"}`); });

    // mobile viewport optimizer
    const mobileOptimizer = getMobileOptimizer();
    const unsubMob = mobileOptimizer.subscribe((vp) => console.log("Viewport changed:", vp));

    // window listeners
    function onPeerLike(e: any) {
      const detail = e.detail;
      if (detail && typeof detail.liked === "boolean") {
        setPeerLikes(detail.liked ? 1 : 0);
        toast(detail.liked ? "Partner liked you ❤️" : "Partner unliked 💔");
      }
    }
    window.addEventListener("rtc:peer-like", onPeerLike as any);

    return () => {
      off1(); off2(); off3(); off4(); off5(); off6(); off7(); off8();
      offOpenMsg(); offCloseMsg(); offRemoteAudio(); offTogglePlay(); offToggleMasks(); offMirror(); offUpsell();
      unsubMob();
      try { window.removeEventListener("rtc:peer-like", onPeerLike as any); } catch {}
      // Full leave on unmount
      leaveRoom().catch(()=>{});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, vip, ffa, router]);

  // ======= UI =======
  return (
    <>
      <LikeHud />
      <div className="min-h-[100dvh] h-[100dvh] w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100" data-chat-container>
        <div className="h-full grid grid-rows-2 gap-2 p-2">
          {/* ======= remote ======= */}
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            {/* Keep HUDs & overlays */}
            {/* <PeerInfoCard ... /> / <PeerMetadata ... /> intentionally omitted to avoid missing import */}
            <FilterBar />
            <MessageHud />

            {/* like */}
            <div className="absolute bottom-4 right-4 z-30"><LikeSystem /></div>

            {/* remote media */}
            <video ref={remoteRef} id="remoteVideo" data-role="remote" className="w-full h-full object-cover" playsInline autoPlay />
            <audio ref={remoteAudioRef} id="remoteAudio" autoPlay playsInline hidden />

            {/* searching overlay */}
            {rtcPhase === "searching" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
                <div className="mb-4">Searching for a partner…</div>
                <button onClick={() => toast("🛑 Search cancelled")} className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto">
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* ======= local ======= */}
          <section className="relative rounded-2xl bg-black/20 overflow-hidden">
            <video ref={localRef} data-local-video className={`w-full h-full object-cover ${isMirrored ? "scale-x-[-1]" : ""}`} playsInline muted autoPlay />
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
                              localRef.current.play().catch(() => {});
                              setReady(true);
                              const sid = newSid();
                              joinViaRedisMatch(sid).catch(()=>{});
                            }
                          })
                          .catch((error) => {
                            console.warn("Retry failed:", error);
                            if ((error as any)?.name === "NotAllowedError") setCameraPermissionHint("Allow camera and microphone from browser settings");
                            else if ((error as any)?.name === "NotReadableError" || (error as any)?.name === "AbortError") setCameraPermissionHint("Close the other tab or allow camera");
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

          {/* bottom bar + messaging + upsell */}
          <ChatToolbar />
          <UpsellModal open={showUpsell} onClose={() => setShowUpsell(false)} />
          <ChatMessagingBar />
        </div>
      </div>
    </>
  );
}
