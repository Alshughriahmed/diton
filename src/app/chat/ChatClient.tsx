// src/app/chat/ChatClient.tsx
"use client";

/**
 * LiveKit-only + Redis match
 * Race-free join/leave using sid guard and connect/leave mutexes.
 * No /api/rtc/* usage. DC shim global. Local preview persists across Next/Prev.
 * Remote media uses LiveKit track.attach()/detach() to avoid adaptiveStream stalls.
 */

import "@/app/chat/dcShim.client";
import "@/app/chat/metaInit.client";
import "@/app/chat/peerMetaUi.client";
import "./freeForAllBridge";
import "./dcMetaResponder.client";
import "./likeSyncClient";
import "./msgSendClient";

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
import { useProfile } from "@/state/profile";
import { normalizeGender } from "@/lib/gender";

import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Track,
  ConnectionState,
} from "livekit-client";

import LikeSystem from "@/components/chat/LikeSystem";
import MyControls from "@/components/chat/MyControls";
import UpsellModal from "@/components/chat/UpsellModal";
import ChatToolbar from "./components/ChatToolbar";
import ChatMessagingBar from "./components/ChatMessagingBar";
import MessageHud from "./components/MessageHud";
import FilterBar from "./components/FilterBar";
import LikeHud from "./LikeHud";
import PeerOverlay from "./components/PeerOverlay";

type Phase = "boot" | "idle" | "searching" | "matched" | "connected" | "stopped";
const NEXT_COOLDOWN_MS = 1200;
const DISCONNECT_TIMEOUT_MS = 1000;
const isBrowser = typeof window !== "undefined";

export default function ChatClient() {
  const ffa = useFFA();
  const router = useRouter();
  const hydrated = useHydrated();
  const { next, prev } = useNextPrev();
  useKeyboardShortcuts();
  useGestures();

  // DOM refs
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // last remote tracks
  const remoteVideoTrackRef = useRef<RemoteTrack | null>(null);
  const remoteAudioTrackRef = useRef<RemoteTrack | null>(null);

  // state
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

  // LiveKit room & guards
  const roomRef = useRef<Room | null>(null);
  const roomUnsubsRef = useRef<(() => void)[]>([]);
  const joiningRef = useRef(false);
  const leavingRef = useRef(false);
  const isConnectingRef = useRef(false);

  // persist audio/cam state across Next/Prev
  const lastMediaStateRef = useRef<{ micOn: boolean; camOn: boolean; remoteMuted: boolean }>({
    micOn: true,
    camOn: true,
    remoteMuted: false,
  });

  // session lock
  const sidRef = useRef(0);
  function newSid(): number { sidRef.current += 1; return sidRef.current; }
  function isActiveSid(sid: number) { return sid === sidRef.current; }

  /* helpers */
  function setPhase(p: Phase) {
    setRtcPhase(p);
    try { window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: p } })); } catch {}
  }
  function emitPair(pairId: string, role: "caller" | "callee") {
    try { window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId, role } })); } catch {}
  }
  function emitRemoteTrackStarted() {
    try { window.dispatchEvent(new CustomEvent("rtc:remote-track", { detail: { started: true } })); } catch {}
  }

  function stableDid(): string {
    try {
      const k = "ditona_did";
      const v = localStorage.getItem(k);
      if (typeof v === "string" && v.length > 0) return v;
      const gen = crypto?.randomUUID?.() || ("did-" + Math.random().toString(36).slice(2, 10));
      localStorage.setItem(k, gen);
      return String(gen);
    } catch { return "did-" + Math.random().toString(36).slice(2, 10); }
  }
  function identity(): string {
    const base = String((profile?.displayName || "anon")).trim() || "anon";
    const did = String(stableDid());
    const tail = did.length >= 6 ? did.slice(0, 6) : ("000000" + did).slice(-6);
    return `${base}#${tail}`;
  }

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
      method: "GET", credentials: "include", cache: "no-store",
    });
    if (r.status === 204) return null;
    if (!r.ok) throw new Error(`next failed ${r.status}`);
    const j = await r.json();
    const raw: unknown = (j as any)?.room;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      return String(obj.name || obj.id || obj.room || JSON.stringify(obj));
    }
    return null;
  }
  async function tokenReq(room: string, id: string): Promise<string> {
    const r = await fetch(`/api/livekit/token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(id)}`, {
      method: "GET", credentials: "include", cache: "no-store",
    });
    if (!r.ok) throw new Error("token failed " + r.status);
    const j = await r.json();
    return String(j.token || "");
  }

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
  function clearRoomListeners() {
    for (const off of roomUnsubsRef.current.splice(0)) { try { off(); } catch {} }
  }

  async function safePlay(el?: HTMLVideoElement | HTMLAudioElement | null) {
    if (!el) return; try { await el.play(); } catch {}
  }

  function attachRemoteTrack(kind: "video" | "audio", track: RemoteTrack | null) {
    const el = kind === "video" ? remoteVideoRef.current : remoteAudioRef.current;
    if (!el || !track) return;
    try { (track as any).attach?.(el); } catch {}
    // restore speaker mute state
    try { el.muted = !!lastMediaStateRef.current.remoteMuted; } catch {}
    safePlay(el);
    if (kind === "video") remoteVideoTrackRef.current = track;
    if (kind === "audio") remoteAudioTrackRef.current = track;
    emitRemoteTrackStarted();
  }
  function detachRemoteAll() {
    try {
      if (remoteVideoTrackRef.current && remoteVideoRef.current) {
        try { (remoteVideoTrackRef.current as any).detach?.(remoteVideoRef.current); } catch {}
      }
      if (remoteAudioTrackRef.current && remoteAudioRef.current) {
        try { (remoteAudioTrackRef.current as any).detach?.(remoteAudioRef.current); } catch {}
      }
    } catch {}
    remoteVideoTrackRef.current = null;
    remoteAudioTrackRef.current = null;
    try { if (remoteVideoRef.current) (remoteVideoRef.current as any).srcObject = null; } catch {}
    try { if (remoteAudioRef.current) (remoteAudioRef.current as any).srcObject = null; } catch {}
  }
  function restoreLocalPreview() {
    const s = getLocalStream();
    if (localRef.current && s) {
      if ((localRef.current as any).srcObject !== s) (localRef.current as any).srcObject = s;
      localRef.current.muted = true;
      safePlay(localRef.current);
    }
  }

  function snapshotMediaState() {
    const s = getLocalStream() as MediaStream | null;
    const micOn = !!s?.getAudioTracks?.()[0]?.enabled;
    const camOn = !!s?.getVideoTracks?.()[0]?.enabled;
    const remoteMuted = !!(remoteAudioRef.current?.muted ?? remoteVideoRef.current?.muted);
    lastMediaStateRef.current = { micOn, camOn, remoteMuted };
  }
  function applyLocalTrackStatesBeforePublish(src: MediaStream) {
    const { micOn, camOn } = lastMediaStateRef.current;
    try { const at = src.getAudioTracks?.()[0]; if (at) at.enabled = !!micOn; } catch {}
    try { const vt = src.getVideoTracks?.()[0]; if (vt) vt.enabled = !!camOn; } catch {}
  }

  async function leaveRoom(): Promise<void> {
    if (leavingRef.current) return;
    leavingRef.current = true;

    snapshotMediaState(); // حفظ حالات الصوت/الصورة
    const room = roomRef.current;
    roomRef.current = null;

    dcDetach();
    clearRoomListeners();
    detachRemoteAll();
    restoreLocalPreview();

    if (room) {
      try {
        const lp: any = room.localParticipant;
        const pubs = typeof lp.getTrackPublications === "function"
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

      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (done) return; done = true;
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

  function wireRoomEvents(room: Room, roomName: string, sid: number) {
    const onTrack = (t: RemoteTrack, pub: RemoteTrackPublication, _p: RemoteParticipant) => {
      if (!isActiveSid(sid)) return;
      try {
        if (pub.kind === Track.Kind.Video && remoteVideoRef.current) {
          attachRemoteTrack("video", t);
        } else if (pub.kind === Track.Kind.Audio && remoteAudioRef.current) {
          attachRemoteTrack("audio", t);
        }
        setPhase("connected");
      } catch {}
    };
    room.on(RoomEvent.TrackSubscribed, onTrack);
    roomUnsubsRef.current.push(() => { try { room.off(RoomEvent.TrackSubscribed, onTrack); } catch {} });

    const onTrackUnsub = (t: RemoteTrack, pub: RemoteTrackPublication) => {
      if (!isActiveSid(sid)) return;
      try {
        if (pub.kind === Track.Kind.Video && remoteVideoRef.current) {
          try { (t as any).detach?.(remoteVideoRef.current); } catch {}
          if (remoteVideoTrackRef.current === t) remoteVideoTrackRef.current = null;
        }
        if (pub.kind === Track.Kind.Audio && remoteAudioRef.current) {
          try { (t as any).detach?.(remoteAudioRef.current); } catch {}
          if (remoteAudioTrackRef.current === t) remoteAudioTrackRef.current = null;
        }
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
        safePlay(remoteVideoRef.current);
        safePlay(remoteAudioRef.current);
      }
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

    const onPeerJoined = () => { requestPeerMetaTwice(room); };
    room.on(RoomEvent.ParticipantConnected, onPeerJoined);
    roomUnsubsRef.current.push(() => { try { room.off(RoomEvent.ParticipantConnected, onPeerJoined); } catch {} });
  }

  // send meta twice helper
  async function requestPeerMetaTwice(room: Room) {
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ t: "meta:init" }));
      await (room.localParticipant as any).publishData(payload, { reliable: true, topic: "meta" });
      setTimeout(async () => {
        try { await (room.localParticipant as any).publishData(payload, { reliable: true, topic: "meta" }); } catch {}
      }, 250);
    } catch {}
  }

  async function waitRoomLoop(ticket: string, sid: number): Promise<string | null> {
    // poll up to 3×8s while sid مازال فعّالًا
    for (let i = 0; i < 3; i++) {
      if (!isActiveSid(sid)) return null;
      const rn = await nextReq(ticket, 8000);
      if (!isActiveSid(sid)) return null;
      if (rn) return rn;
    }
    return null;
  }

  async function joinViaRedisMatch(sid: number): Promise<void> {
    if (!isActiveSid(sid) || joiningRef.current || leavingRef.current || isConnectingRef.current) return;
    if (roomRef.current?.state === "connecting") return;

    joiningRef.current = true;
    setPhase("searching");

    try {
      // filters
      let selfCountry: string | null = null;
      try {
        const g = JSON.parse(localStorage.getItem("ditona_geo") || "null");
        if (g?.country) selfCountry = String(g.country).toUpperCase();
      } catch {}
      const selfGender = normalizeGender(profile?.gender ?? gender ?? "u");
      const selected = normalizeGender(gender ?? "u");
      const gFilter = selected === "u" ? [] : [selected];

      // enqueue
      const ticket = await enqueueReq({
        identity: identity(),
        deviceId: stableDid(),
        vip: !!vip,
        selfGender,
        selfCountry,
        filterGenders: gFilter,
        filterCountries: Array.isArray(countries) ? countries : [],
      });
      if (!isActiveSid(sid)) return;

      // wait room with polling
      const roomName = await waitRoomLoop(ticket, sid);
      if (!roomName) { setPhase("stopped"); return; }

      // prepare room
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      wireRoomEvents(room, roomName, sid);

      // token + connect
      const id = identity();
      const token = await tokenReq(roomName, id);
      if (!isActiveSid(sid)) return;

      detachRemoteAll();
      setPhase("matched");
      emitPair(roomName, "caller");

      const ws = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || "";
      isConnectingRef.current = true;
      await room.connect(ws, token);
      if (!isActiveSid(sid)) { try { await room.disconnect(false); } catch {} isConnectingRef.current = false; return; }

      (globalThis as any).__lkRoom = room;
      dcAttach(room);

      await requestPeerMetaTwice(room);

      // publish local tracks AFTER connected, reapply user states
      const src = (effectsStream ?? getLocalStream()) || null;
      if (src && room.state === "connected") {
        applyLocalTrackStatesBeforePublish(src);
        for (const t of src.getTracks()) {
          if (!isActiveSid(sid)) break;
          try { await room.localParticipant.publishTrack(t); } catch {}
        }
      }
      // restore speaker mute
      try {
        const muted = !!lastMediaStateRef.current.remoteMuted;
        if (remoteAudioRef.current) remoteAudioRef.current.muted = muted;
        if (remoteVideoRef.current) remoteVideoRef.current.muted = muted;
      } catch {}
      setPhase("connected");
    } catch (e) {
      console.warn("joinViaRedisMatch failed", e);
      setPhase("stopped");
    } finally {
      joiningRef.current = false;
      isConnectingRef.current = false;
    }
  }

  useEffect(() => {
    if (!hydrated || !isBrowser) return;

    (async () => {
      setPhase("boot");
      try {
        const s0 = await initLocalMedia().then(() => getLocalStream()).catch(() => getLocalStream());
        if (localRef.current && s0) {
          (localRef.current as any).srcObject = s0;
          localRef.current.muted = true;
          await safePlay(localRef.current);
        }
        setReady(true);
        const sid = newSid();
        await joinViaRedisMatch(sid);
      } catch (error: any) {
        if (error?.name === "NotAllowedError")
          setCameraPermissionHint("Allow camera and microphone from browser settings");
        else if (error?.name === "NotReadableError" || error?.name === "AbortError")
          setCameraPermissionHint("Close the other tab/app using the camera");
        else if (error?.name === "NotFoundError")
          setCameraPermissionHint("No camera or microphone found");
        else setCameraPermissionHint("Camera access error — check permissions");
      }
    })().catch(()=>{});

    const offs: Array<() => void> = [];
    offs.push(on("ui:toggleMic", () => toggleMic()));
    offs.push(on("ui:toggleCam", () => toggleCam()));
    offs.push(on("ui:switchCamera", async () => {
      try {
        const newStream = await switchCamera();
        if (localRef.current && newStream) {
          (localRef.current as any).srcObject = newStream;
          safePlay(localRef.current);
        }
        const room = roomRef.current;
        if (room && room.state === "connected") {
          const lp: any = room.localParticipant;
          const pubs = typeof lp.getTrackPublications === "function"
            ? lp.getTrackPublications()
            : Array.from(lp.trackPublications?.values?.() ?? []);
          for (const pub of pubs) {
            const k = (pub as any).kind;
            const src = (pub as any).source;
            const tr: any = (pub as any).track;
            if ((k === Track.Kind.Video || src === "camera") && tr) {
              try { await lp.unpublishTrack(tr, { stop: false }); } catch {}
            }
          }
          const nv = newStream.getVideoTracks()[0];
          if (nv) { try { await room.localParticipant.publishTrack(nv); } catch {} }
        }
      } catch {}
    }));
    offs.push(on("ui:openSettings", () => { try { window.location.href = "/settings"; } catch {} }));

    offs.push(on("ui:like", async () => {
      const room = roomRef.current;
      if (!room || room.state !== "connected") { toast("No active connection for like"); return; }
      const newLike = !like; setLike(newLike);
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ t: "like", liked: newLike }));
        await (room.localParticipant as any).publishData(payload, { reliable: true, topic: "like" });
      } catch {}
      toast(`Like ${newLike ? "❤️" : "💔"}`);
    }));
    offs.push(on("ui:report", () => { toast("Report sent. Moving on"); }));

    offs.push(on("ui:next", async () => {
      const now = Date.now();
      if (joiningRef.current || leavingRef.current || isConnectingRef.current || roomRef.current?.state === "connecting") return;
      if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
      lastNextTsRef.current = now;
      toast("⏭️ Next");
      const sid = newSid();
      await leaveRoom();
      await new Promise(r => setTimeout(r, 250));
      restoreLocalPreview();
      await joinViaRedisMatch(sid);
    }));

    offs.push(on("ui:prev", async () => {
      if (!vip && !ffa) { toast("🔒 Going back is VIP only"); emit("ui:upsell", "prev"); return; }
      toast("⏮️ Previous");
      const now = Date.now();
      if (joiningRef.current || leavingRef.current || isConnectingRef.current || roomRef.current?.state === "connecting") return;
      if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
      lastNextTsRef.current = now;
      const sid = newSid();
      await leaveRoom();
      await new Promise(r => setTimeout(r, 250));
      restoreLocalPreview();
      await joinViaRedisMatch(sid);
    }));

    offs.push(on("ui:openMessaging" as any, () => setShowMessaging(true)));
    offs.push(on("ui:closeMessaging" as any, () => setShowMessaging(false)));

    offs.push(on("ui:toggleRemoteAudio" as any, () => {
      const a = remoteAudioRef.current;
      const v = remoteVideoRef.current;
      const target: any = a ?? v;
      if (target) {
        target.muted = !target.muted;
        lastMediaStateRef.current.remoteMuted = target.muted;
        toast(target.muted ? "Remote muted" : "Remote unmuted");
      }
    }));

    offs.push(on("ui:togglePlay", () => toast("Toggle matching state")));
    offs.push(on("ui:toggleMasks", () => { toast("Enable/disable masks"); }));
    offs.push(on("ui:toggleMirror", () => {
      setIsMirrored(prev => { const s = !prev; toast(s ? "Mirror on" : "Mirror off"); return s; });
    }));
    offs.push(on("ui:upsell", (d: any) => { if (ffa) return; router.push(`/plans?ref=${d?.ref || d?.feature || "generic"}`); }));

    const mobileOptimizer = getMobileOptimizer();
    const unsubMob = mobileOptimizer.subscribe(() => {});

    return () => {
      for (const off of offs) try { off(); } catch {}
      unsubMob();
      leaveRoom().catch(()=>{});
    };
  }, [hydrated, vip, ffa, router, gender, countries, profile?.gender]);

  return (
    <>
      <LikeHud />
      <div className="min-h-[100dvh] h-[100dvh] w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100" data-chat-container>
        <div className="h-full grid grid-rows-2 gap-2 p-2">
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <FilterBar />
            <MessageHud />
            <PeerOverlay />
            <div className="absolute bottom-4 right-4 z-30"><LikeSystem /></div>

            <video ref={remoteVideoRef} id="remoteVideo" data-role="remote" className="w-full h-full object-cover" playsInline autoPlay />
            <audio ref={remoteAudioRef} id="remoteAudio" autoPlay playsInline hidden />

            {rtcPhase === "searching" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
                <div className="mb-4">Searching for a partner…</div>
                <button onClick={() => toast("🛑 Search cancelled")}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto">
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
              playsInline muted autoPlay />
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
                              (localRef.current as any).srcObject = s;
                              localRef.current.muted = true;
                              safePlay(localRef.current);
                              setReady(true);
                              const sid = newSid();
                              joinViaRedisMatch(sid).catch(()=>{});
                            }
                          })
                          .catch((error) => {
                            if ((error as any)?.name === "NotAllowedError") setCameraPermissionHint("Allow camera and microphone from browser settings");
                            else if ((error as any)?.name === "NotReadableError" || (error as any)?.name === "AbortError") setCameraPermissionHint("Close the other tab or allow camera");
                            else setCameraPermissionHint("Camera access error — check permissions");
                          });
                      }}
                      className="px-4 py-2 bg-blue-500/80 hover:bg-blue-600/80 rounded-lg text-white font-medium transition-colors duration-200">
                      Retry
                    </button>
                  </>
                ) : (<div>Requesting camera/mic…</div>)}
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
