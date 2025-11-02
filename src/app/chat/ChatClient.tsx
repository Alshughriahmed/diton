"use client";

import "@/app/chat/dcShim.client";
import "./dcMetaResponder.client";
import "@/app/chat/metaInit.client";
import "@/app/chat/peerMetaUi.client";

import "./freeForAllBridge";
import "./likeSyncClient";
import "./msgSendClient";
import "@/app/i18nReset.client";

import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGestures } from "@/hooks/useGestures";
import {
  initLocalMedia,
  getLocalStream,
  toggleMic,
  toggleCam,
  switchCameraCycle,
  isTorchSupported,
  toggleTorch,
  getCurrentFacing,
  getMicState,
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

import { startEffects, stopEffects, setMask, setBeautyEnabled } from "@/lib/effects/core";

import LikeSystem from "@/components/chat/LikeSystem";
import MyControls from "@/components/chat/MyControls";
import UpsellModal from "@/components/chat/UpsellModal";
import ChatToolbar from "./components/ChatToolbar";
import ChatMessagingBar from "./components/ChatMessagingBar";
import MessageHud from "./components/MessageHud";
import FilterBar from "./components/FilterBar";
import PeerOverlay from "./components/PeerOverlay";
import MaskTray from "@/app/chat/components/MaskTray";

import { vibrate } from "@/lib/vibrate";

type Phase = "boot" | "idle" | "searching" | "matched" | "connected";

const NEXT_COOLDOWN_MS = 1000;
const DISCONNECT_TIMEOUT_MS = 900;
const SWITCH_PAUSE_MS = 240;

/* ---------- helpers specific to this file ---------- */

function toISO2(val?: unknown): string | undefined {
  const v = (val ?? "").toString().trim();
  if (v.length === 2) return v.toUpperCase();
  return v ? v : undefined;
}

function injectPairAndNormalizeMeta(roomName: string, raw: any) {
  const meta = raw ?? {};
  const norm = {
    displayName: meta.displayName ?? "",
    gender: normalizeGender(meta.gender as any),
    country: toISO2(meta.country),
    city: meta.city ?? "",
    likes: typeof meta.likes === "number" ? meta.likes : undefined,
    vip: !!meta.vip,
    avatarUrl: typeof meta.avatarUrl === "string" ? meta.avatarUrl : undefined,
    hideCountry: !!meta.hideCountry,
    hideCity: !!meta.hideCity,
    hideLikes: !!meta.hideLikes,
    did: meta.did || meta.deviceId || meta.peerDid || meta.id || meta.identity,
  };
  return { pairId: roomName, meta: norm };
}

async function ensureSubscribedToRemoteVideo(room: Room) {
  const p = [...room.remoteParticipants.values()][0];
  if (!p) return;
  try {
    for (const pub of p.trackPublications.values()) {
      if (pub.kind === Track.Kind.Video && !pub.isSubscribed) {
        try {
          await pub.setSubscribed(true);
        } catch {}
      }
    }
  } catch {}
}

const isEveryoneLike = (g: unknown) => {
  const v = String(g ?? "").toLowerCase();
  return v === "everyone" || v === "all" || v === "u";
};

function readLSBool(key: string, defVal: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
    return defVal;
  } catch {
    return defVal;
  }
}

/* =================================================== */

export default function ChatClient() {
  const ffa = useFFA();
  const router = useRouter();
  useKeyboardShortcuts();
  useGestures();

  const filters = useFilters();
  const { profile } = useProfile();

  // refs
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoTrackRef = useRef<RemoteTrack | null>(null);
  const remoteAudioTrackRef = useRef<RemoteTrack | null>(null);

  const [ready, setReady] = useState(false);
  const [rtcPhase, setRtcPhase] = useState<Phase>("idle");
  const [showMessaging, setShowMessaging] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraPermissionHint, setCameraPermissionHint] = useState<string>("");

  const [maskOpen, setMaskOpen] = useState(false);

  const effectsOnRef = useRef<boolean>(false);
  const effectsMaskOnRef = useRef<boolean>(false);
  const beautyOnRef = useRef<boolean>(false);
  const processedStreamRef = useRef<MediaStream | null>(null);

  const roomRef = useRef<Room | null>(null);
  const roomUnsubsRef = useRef<(() => void)[]>([]);
  const joiningRef = useRef(false);
  const leavingRef = useRef(false);
  const isConnectingRef = useRef(false);
  const rejoinTimerRef = useRef<number | null>(null);

  const manualSwitchRef = useRef(false);

  const lastMediaStateRef = useRef<{ micOn: boolean; camOn: boolean; remoteMuted: boolean }>({
    micOn: true,
    camOn: true,
    remoteMuted: false,
  });

  const remoteDidRef = useRef<string>("");

  // matching
  const sidRef = useRef(0);
  const lastNextTsRef = useRef(0);
  const pollAbortRef = useRef<AbortController | null>(null);
  const tokenAbortRef = useRef<AbortController | null>(null);
  const searchStartRef = useRef(0);
  const [searchMsg, setSearchMsg] = useState("Searching for a match…");
  const lastTicketRef = useRef<string>("");

  function newSid(): number {
    try {
      pollAbortRef.current?.abort();
    } catch {}
    try {
      tokenAbortRef.current?.abort();
    } catch {}
    pollAbortRef.current = null;
    tokenAbortRef.current = null;
    sidRef.current += 1;
    return sidRef.current;
  }
  const isActiveSid = (sid: number) => sid === sidRef.current;

  function abortPolling() {
    try {
      pollAbortRef.current?.abort();
    } catch {}
    pollAbortRef.current = null;
  }

  function setPhase(p: Phase) {
    setRtcPhase(p);
    try {
      window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: p } }));
    } catch {}
    if (p === "searching") {
      searchStartRef.current = Date.now();
      setSearchMsg("Searching for a match…");
      try {
        window.dispatchEvent(new CustomEvent("ui:msg:reset"));
      } catch {}
    }
  }

  function emitPair(pairId: string, role: "caller" | "callee") {
    try {
      window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId, role } }));
      window.dispatchEvent(new CustomEvent("ui:msg:reset", { detail: { pairId } }));
    } catch {}
  }

  function emitRemoteTrackStarted() {
    try {
      window.dispatchEvent(new CustomEvent("rtc:remote-track", { detail: { started: true } }));
    } catch {}
  }

  function broadcastMediaState() {
    try {
      window.dispatchEvent(
        new CustomEvent("media:state", {
          detail: {
            facing: getCurrentFacing(),
            torchSupported: isTorchSupported(),
            micOn: getMicState(),
            remoteMuted: !!lastMediaStateRef.current.remoteMuted,
          },
        })
      );
    } catch {}
  }

  function stableDid(): string {
    try {
      const k = "ditona_did";
      const v = localStorage.getItem(k);
      if (typeof v === "string" && v.length > 0) return v;
      const gen = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(k, gen);
      return String(gen);
    } catch {
      return "did-" + Math.random().toString(36).slice(2, 10);
    }
  }

  function identity(): string {
    const base = String(profile?.displayName || "anon").trim() || "anon";
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

  async function nextReq(ticket: string, waitMs = 8000, signal?: AbortSignal): Promise<string | null> {
    const r = await fetch(`/api/match/next?ticket=${encodeURIComponent(ticket)}&wait=${waitMs}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal,
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

  async function prevReq(ticket: string): Promise<string | null> {
    if (!ticket) return null;
    const r = await fetch(`/api/match/prev?ticket=${encodeURIComponent(ticket)}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (r.status === 204) return null;
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return typeof j?.room === "string" ? j.room : null;
  }

  async function tokenReq(room: string, id: string, signal?: AbortSignal): Promise<string> {
    const r = await fetch(
      `/api/livekit/token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(id)}`,
      { method: "GET", credentials: "include", cache: "no-store", signal }
    );
    if (!r.ok) throw new Error("token failed " + r.status);
    const j = await r.json();
    return String(j.token || "");
  }

  function dcAttach(room: Room) {
    const dc: any = (globalThis as any).__ditonaDataChannel;
    try {
      dc?.attach?.(room);
      dc?.setConnected?.(true);
      window.dispatchEvent(new CustomEvent("dc:attached"));
    } catch {}
  }
  function dcDetach() {
    const dc: any = (globalThis as any).__ditonaDataChannel;
    try {
      dc?.setConnected?.(false);
      dc?.detach?.();
    } catch {}
  }

  function clearRoomListeners() {
    for (const off of roomUnsubsRef.current.splice(0)) {
      try {
        off();
      } catch {}
    }
  }

  async function safePlay(el?: HTMLVideoElement | HTMLAudioElement | null) {
    if (!el) return;
    try {
      await el.play();
    } catch {}
  }

  async function ensureLocalAliveLocal(): Promise<MediaStream | null> {
    try {
      let s = getLocalStream() as MediaStream | null;
      const vt = s?.getVideoTracks?.()[0] || null;
      const at = s?.getAudioTracks?.()[0] || null;
      const videoEnded = !vt || vt.readyState === "ended";
      const audioEnded = at ? at.readyState === "ended" : false;
      if (!s || videoEnded || audioEnded) {
        await initLocalMedia().catch(() => {});
        s = getLocalStream() as MediaStream | null;
      }
      return s ?? null;
    } catch {
      await initLocalMedia().catch(() => {});
      return (getLocalStream() as MediaStream | null) ?? null;
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
    try {
      const at = src.getAudioTracks?.()[0];
      if (at) at.enabled = !!micOn;
    } catch {}
    try {
      const vt = src.getVideoTracks?.()[0];
      if (vt) vt.enabled = !!camOn;
    } catch {}
  }

  function attachRemoteTrack(kind: "video" | "audio", track: RemoteTrack | null) {
    const el = kind === "video" ? remoteVideoRef.current : remoteAudioRef.current;
    if (!el || !track) return;
    try {
      (track as any).attach?.(el);
      el.muted = !!lastMediaStateRef.current.remoteMuted;
    } catch {}
    safePlay(el);
    if (kind === "video") remoteVideoTrackRef.current = track;
    if (kind === "audio") remoteAudioTrackRef.current = track;
    emitRemoteTrackStarted();
  }

  function detachRemoteAll() {
    try {
      if (remoteVideoTrackRef.current && remoteVideoRef.current) {
        try {
          (remoteVideoTrackRef.current as any).detach?.(remoteVideoRef.current);
        } catch {}
      }
      if (remoteAudioTrackRef.current && remoteAudioRef.current) {
        try {
          (remoteAudioTrackRef.current as any).detach?.(remoteAudioRef.current);
        } catch {}
      }
    } catch {}
    remoteVideoTrackRef.current = null;
    remoteAudioTrackRef.current = null;
    try {
      if (remoteVideoRef.current) (remoteVideoRef.current as any).srcObject = null;
      if (remoteAudioRef.current) (remoteAudioRef.current as any).srcObject = null;
    } catch {}
  }

  function subscribeAll(p: RemoteParticipant) {
    try {
      for (const pub of p.trackPublications.values()) {
        if (!pub.isSubscribed) {
          try {
            (pub as any).setSubscribed?.(true);
          } catch {}
        }
      }
    } catch {}
  }
  function subscribeAllExisting(room: Room) {
    try {
      for (const rp of room.remoteParticipants.values()) subscribeAll(rp);
    } catch {}
  }

  async function requestPeerMetaTwice(room: Room) {
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ t: "meta:init" }));
      await (room.localParticipant as any).publishData(payload, { reliable: true, topic: "meta" });
      setTimeout(async () => {
        try {
          await (room.localParticipant as any).publishData(payload, { reliable: true, topic: "meta" });
        } catch {}
      }, 250);
    } catch {}
  }

  async function waitRoomLoop(ticket: string, sid: number, maxMs = 60000): Promise<string | "__expired__" | null> {
    const started = Date.now();
    let wait = 8000;
    while (isActiveSid(sid)) {
      if (Date.now() - started > maxMs) return "__expired__";
      const ctrl = new AbortController();
      pollAbortRef.current = ctrl;
      let rn: string | null = null;
      try {
        rn = await nextReq(ticket, wait, ctrl.signal);
      } catch {
        /* network / 401 etc. */
      } finally {
        if (pollAbortRef.current === ctrl) pollAbortRef.current = null;
      }
      if (!isActiveSid(sid)) return null;
      if (rn) return rn;
      wait = Math.min(20000, Math.round(wait * 1.25));
    }
    return null;
  }

  async function leaveRoom(opts?: { bySwitch?: boolean }): Promise<void> {
    if (leavingRef.current) return;
    leavingRef.current = true;
    manualSwitchRef.current = !!opts?.bySwitch;

    snapshotMediaState();
    abortPolling();

    try {
      if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
    } catch {}

    const room = roomRef.current;
    roomRef.current = null;

    dcDetach();
    clearRoomListeners();

    try {
      (window as any).__ditonaPairId = undefined;
      (window as any).__pairId = undefined;
    } catch {}

    detachRemoteAll();

    if (room) {
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          try {
            room.off(RoomEvent.Disconnected, finish);
          } catch {}
          resolve();
        };
        try {
          room.on(RoomEvent.Disconnected, finish);
        } catch {}
        try {
          room.disconnect(false);
        } catch {
          finish();
        }
        setTimeout(finish, DISCONNECT_TIMEOUT_MS);
      });
    }

    (globalThis as any).__lkRoom = null;
    remoteDidRef.current = "";
    leavingRef.current = false;
  }

  function wireRoomEvents(room: Room, roomName: string, sid: number) {
    const onTrack = (t: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (!isActiveSid(sid)) return;
      try {
        remoteDidRef.current = String(p?.identity || "");
        (window as any).__ditonaPeerDid = remoteDidRef.current;
        (window as any).__peerDid = remoteDidRef.current;
      } catch {}
      try {
        if (pub.kind === Track.Kind.Video && remoteVideoRef.current) attachRemoteTrack("video", t);
        else if (pub.kind === Track.Kind.Audio && remoteAudioRef.current) attachRemoteTrack("audio", t);
        setPhase("connected");
      } catch {}
    };
    room.on(RoomEvent.TrackSubscribed, onTrack);
    roomUnsubsRef.current.push(() => {
      try {
        room.off(RoomEvent.TrackSubscribed, onTrack);
      } catch {}
    });

    const onTrackUnsub = (t: RemoteTrack, pub: RemoteTrackPublication) => {
      if (!isActiveSid(sid)) return;
      try {
        if (pub.kind === Track.Kind.Video && remoteVideoRef.current) {
          try {
            (t as any).detach?.(remoteVideoRef.current);
          } catch {}
          if (remoteVideoTrackRef.current === t) remoteVideoTrackRef.current = null;
        }
        if (pub.kind === Track.Kind.Audio && remoteAudioRef.current) {
          try {
            (t as any).detach?.(remoteAudioRef.current);
          } catch {}
          if (remoteAudioTrackRef.current === t) remoteAudioTrackRef.current = null;
        }
      } catch {}
    };
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsub);
    roomUnsubsRef.current.push(() => {
      try {
        room.off(RoomEvent.TrackUnsubscribed, onTrackUnsub);
      } catch {}
    });

    const onTrackPublished = (_pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (!isActiveSid(sid)) return;
      subscribeAll(p);
      void ensureSubscribedToRemoteVideo(room);
    };
    room.on(RoomEvent.TrackPublished, onTrackPublished as any);
    roomUnsubsRef.current.push(() => {
      try {
        room.off(RoomEvent.TrackPublished, onTrackPublished as any);
      } catch {}
    });

    const onConn = (state: ConnectionState) => {
      if (!isActiveSid(sid)) return;
      if (state === "reconnecting") setPhase("searching");
      else if (state === "connected") {
        setPhase("connected");
        safePlay(remoteVideoRef.current);
        safePlay(remoteAudioRef.current);
        void ensureSubscribedToRemoteVideo(room);
        try {
          window.dispatchEvent(new CustomEvent("lk:attached"));
        } catch {}
        try {
          const muted = !!lastMediaStateRef.current.remoteMuted;
          if (remoteAudioRef.current) remoteAudioRef.current.muted = muted;
          if (remoteVideoRef.current) remoteVideoRef.current.muted = muted;
        } catch {}
        broadcastMediaState();
        manualSwitchRef.current = false;
      }
    };
    room.on(RoomEvent.ConnectionStateChanged, onConn);
    roomUnsubsRef.current.push(() => {
      try {
        room.off(RoomEvent.ConnectionStateChanged, onConn);
      } catch {}
    });

   const onData = (payload: Uint8Array, _p?: RemoteParticipant, _k?: any, topic?: string) => {
  if (!isActiveSid(sid)) return;
  try {
    const txt = new TextDecoder().decode(payload);
    if (!txt || !/^\s*\{/.test(txt)) return;
    const j = JSON.parse(txt);

    // إشعار تبادل الميتا فقط
    if (j?.t === "meta:init" || topic === "meta") {
      try { window.dispatchEvent(new CustomEvent("ditona:meta:init")); } catch {}
      return;
    }

    // تمرير رسائل الدردشة
    if ((j?.t === "chat" || topic === "chat") && typeof j.text === "string") {
      const pid = typeof j.pairId === "string" && j.pairId ? j.pairId : roomName;
      window.dispatchEvent(new CustomEvent("ditona:chat:recv", { detail: { text: j.text, pairId: pid } }));
      return;
    }

    // باقي الأنواع تُدار حصراً في dcMetaResponder.client.ts
    return;
  } catch {}
};

        // --- Unified peer-meta ---
        // Accept shapes:
        // 1) {t:'peer-meta', payload:{...}}
        // 2) {t:'meta', meta:{...}}
        // 3) {meta:{...}} on topic 'meta'
        if ((j?.t === "peer-meta" && j.payload) || (j?.t === "meta" && j.meta) || (topic === "meta" && j?.meta)) {
          const rawMeta = j.payload || j.meta;
          const detail = injectPairAndNormalizeMeta(roomName, rawMeta);
          window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail }));
          try {
            const did = rawMeta?.did || rawMeta?.deviceId || rawMeta?.peerDid || rawMeta?.id || rawMeta?.identity;
            if (did) {
              remoteDidRef.current = String(did);
              (window as any).__ditonaPeerDid = remoteDidRef.current;
              (window as any).__peerDid = remoteDidRef.current;
            }
          } catch {}
          return;
        }

      } catch {}
    };
    room.on(RoomEvent.DataReceived, onData as any);
    roomUnsubsRef.current.push(() => {
      try {
        room.off(RoomEvent.DataReceived, onData as any);
      } catch {}
    });

    const onPart = () => {
      if (!isActiveSid(sid)) return;
      setPhase("searching");
      try {
        window.dispatchEvent(new CustomEvent("livekit:participant-disconnected"));
      } catch {}
    };
    room.on(RoomEvent.ParticipantDisconnected, onPart);
    roomUnsubsRef.current.push(() => {
      try {
        room.off(RoomEvent.ParticipantDisconnected, onPart);
      } catch {}
    });

    const onDisc = () => {
      if (!isActiveSid(sid)) return;
      dcDetach();
      setPhase("searching");
      broadcastMediaState();

      if (manualSwitchRef.current || leavingRef.current || joiningRef.current || isConnectingRef.current) return;

      try {
        if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
      } catch {}
      rejoinTimerRef.current = window.setTimeout(() => {
        if (!isActiveSid(sid)) return;
        if (joiningRef.current || leavingRef.current || isConnectingRef.current) return;
        const ns = newSid();
        joinViaRedisMatch(ns).catch(() => {});
      }, 650);
    };
    room.on(RoomEvent.Disconnected, onDisc);
    roomUnsubsRef.current.push(() => {
      try {
        room.off(RoomEvent.Disconnected, onDisc);
      } catch {}
    });

    const onPeerJoined = (p: RemoteParticipant) => {
      if (!isActiveSid(sid)) return;
      try {
        remoteDidRef.current = String(p?.identity || "");
        (window as any).__ditonaPeerDid = remoteDidRef.current;
        (window as any).__peerDid = remoteDidRef.current;
      } catch {}
      subscribeAll(p);
      void ensureSubscribedToRemoteVideo(room);
      requestPeerMetaTwice(room);
      try {
        window.dispatchEvent(new CustomEvent("livekit:participant-connected"));
      } catch {}
    };
    room.on(RoomEvent.ParticipantConnected, onPeerJoined);
    roomUnsubsRef.current.push(() => {
      try {
        room.off(RoomEvent.ParticipantConnected, onPeerJoined);
      } catch {}
    });
  }

  async function replaceLocalVideoTrack(stream: MediaStream | null) {
    if (!stream) return;

    if (localRef.current && (localRef.current as any).srcObject !== stream) {
      (localRef.current as any).srcObject = stream;
      localRef.current.muted = true;
      await safePlay(localRef.current);
    }

    const room = roomRef.current;
    const vt = stream.getVideoTracks?.()[0];
    if (!room || room.state !== "connected" || !vt) return;

    try {
      const lp: any = room.localParticipant;
      const pubs =
        typeof lp.getTrackPublications === "function"
          ? lp.getTrackPublications()
          : Array.from(lp.trackPublications?.values?.() ?? []);
      const vidPub = pubs.find((p: any) => p.kind === Track.Kind.Video && p.track);
      const pubTrack: any = vidPub?.track;

      if (pubTrack && typeof pubTrack.replaceTrack === "function") {
        await pubTrack.replaceTrack(vt);
      } else {
        for (const pub of pubs) {
          if (pub.kind === Track.Kind.Video && pub.track) {
            await lp.unpublishTrack(pub.track, { stop: false });
          }
        }
        await room.localParticipant.publishTrack(vt);
      }
    } catch {}
  }

  async function ensureEffectsRunning() {
    if (effectsOnRef.current) return;
    const src = getLocalStream();
    if (!src) return;
    const processed = await startEffects(src).catch(() => null);
    if (!processed) return;
    processedStreamRef.current = processed;
    effectsOnRef.current = true;
    applyLocalTrackStatesBeforePublish(processed);
    await replaceLocalVideoTrack(processed);
    broadcastMediaState();
  }

  async function enableBeauty(on: boolean) {
    beautyOnRef.current = on;
    setBeautyEnabled(on);
    try {
      localStorage.setItem("ditona_beauty_on", on ? "1" : "0");
    } catch {}
    if (on) {
      await ensureEffectsRunning();
      toast("Beauty ON");
    } else {
      if (!effectsMaskOnRef.current) {
        await disableAllEffects();
      } else {
        toast("Beauty OFF");
      }
    }
  }

  async function enableMask(name: string | null) {
    if (name) {
      await setMask(name).catch(() => {});
      effectsMaskOnRef.current = true;
      await ensureEffectsRunning();
      toast(`Mask: ${name}`);
      try {
        localStorage.setItem("ditona_mask_name", name);
        localStorage.setItem("ditona_mask", name);
      } catch {}
    } else {
      await setMask(null as any).catch(() => {});
      effectsMaskOnRef.current = false;
      try {
        localStorage.setItem("ditona_mask_name", "null");
        localStorage.removeItem("ditona_mask");
      } catch {}
      if (!beautyOnRef.current) await disableAllEffects();
      else toast("Mask OFF");
    }
  }

  async function disableAllEffects() {
    const raw = getLocalStream();
    const restored = await stopEffects(raw ?? (processedStreamRef.current as any)).catch(() => raw);
    processedStreamRef.current = null;
    effectsOnRef.current = false;
    if (restored) {
      applyLocalTrackStatesBeforePublish(restored);
      await replaceLocalVideoTrack(restored);
    }
    broadcastMediaState();
    toast("Effects OFF");
  }

  async function joinViaRedisMatch(sid: number): Promise<void> {
    if (!isActiveSid(sid) || joiningRef.current || leavingRef.current || isConnectingRef.current) return;
    if (roomRef.current?.state === "connecting") return;

    joiningRef.current = true;
    setPhase("searching");
    abortPolling();

    const buildPayload = () => {
      let selfCountry: string | null = null;
      try {
        const g = JSON.parse(localStorage.getItem("ditona_geo") || "null");
        if (g?.country) selfCountry = String(g.country).toUpperCase();
      } catch {}

      const selfGenderNorm = normalizeGender(profile?.gender as any);
      const payloadSelfGender = isEveryoneLike(selfGenderNorm) ? undefined : (selfGenderNorm as any);

      const filterGendersNorm =
        typeof filters.filterGendersNorm === "function"
          ? (filters.filterGendersNorm() as ("m" | "f" | "c" | "l")[])
          : (() => {
              const sel = normalizeGender(filters.gender as any);
              return isEveryoneLike(sel) ? [] : ([sel as any] as ("m" | "f" | "c" | "l")[]);
            })();

      return {
        identity: identity(),
        deviceId: stableDid(),
        vip: !!filters.isVip,
        selfGender: payloadSelfGender,
        selfCountry,
        filterGenders: filterGendersNorm,
        filterCountries: Array.isArray(filters.countries) ? filters.countries : [],
      };
    };

    try {
      let payload = buildPayload();
      let ticket = await enqueueReq(payload);
      lastTicketRef.current = ticket;
      if (!isActiveSid(sid)) return;

      let roomName: string | null = null;
      while (isActiveSid(sid) && !roomName) {
        const res = await waitRoomLoop(ticket, sid, 60000);
        if (!isActiveSid(sid)) return;
        if (res === "__expired__") {
          // refresh ticket
          payload = buildPayload();
          ticket = await enqueueReq(payload);
          lastTicketRef.current = ticket;
          setPhase("searching");
          continue;
        }
        if (!res) {
          setPhase("searching");
          continue;
        }
        roomName = res;
      }
      if (!roomName || !isActiveSid(sid)) return;

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      wireRoomEvents(room, roomName, sid);

      const id = identity();

      const tokCtrl = new AbortController();
      tokenAbortRef.current = tokCtrl;
      const token = await tokenReq(roomName, id, tokCtrl.signal);
      tokenAbortRef.current = null;
      if (!isActiveSid(sid)) return;

      detachRemoteAll();
      setPhase("matched");
      emitPair(roomName, "caller");
      try {
        (window as any).__ditonaPairId = roomName;
        (window as any).__pairId = roomName;
      } catch {}

      const ws = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL as string;
      isConnectingRef.current = true;
      await room.connect(ws, token);
      await ensureSubscribedToRemoteVideo(room);
      if (!isActiveSid(sid)) {
        try {
          await room.disconnect(false);
        } catch {}
        isConnectingRef.current = false;
        return;
      }

      (globalThis as any).__lkRoom = room;
      try { window.dispatchEvent(new CustomEvent("lk:attached")); } catch {}
      dcAttach(room);

      subscribeAllExisting(room);
      await requestPeerMetaTwice(room);

      const publishSrc = processedStreamRef.current ?? getLocalStream() ?? null;
      if (publishSrc && room.state === "connected") {
        applyLocalTrackStatesBeforePublish(publishSrc);
        for (const t of publishSrc.getTracks()) {
          if (!isActiveSid(sid)) break;
          try {
            await room.localParticipant.publishTrack(t);
          } catch {}
        }
      }

      try {
        const muted = !!lastMediaStateRef.current.remoteMuted;
        if (remoteAudioRef.current) remoteAudioRef.current.muted = muted;
        if (remoteVideoRef.current) remoteVideoRef.current.muted = muted;
      } catch {}
      setPhase("connected");
      broadcastMediaState();
    } catch {
      setPhase("searching");
    } finally {
      joiningRef.current = false;
      isConnectingRef.current = false;
      if (manualSwitchRef.current && isActiveSid(sid)) manualSwitchRef.current = false;
    }
  }

  async function tryPrevReconnect(): Promise<boolean> {
    const ticket = lastTicketRef.current || "";
    if (!ticket) return false;
    const roomName = await prevReq(ticket);
    if (!roomName) return false;

    const sid = newSid();
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    wireRoomEvents(room, roomName, sid);

    const id = identity();
    const tokCtrl = new AbortController();
    tokenAbortRef.current = tokCtrl;
    const token = await tokenReq(roomName, id, tokCtrl.signal).catch(() => "");
    tokenAbortRef.current = null;

    detachRemoteAll();
    setPhase("matched");
    emitPair(roomName, "caller");
    try {
      (window as any).__ditonaPairId = roomName;
      (window as any).__pairId = roomName;
    } catch {}

    const ws = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL as string;
    isConnectingRef.current = true;
    await room.connect(ws, token).catch(() => {});
    isConnectingRef.current = false;

    if (room.state !== "connected") return false;

    await ensureSubscribedToRemoteVideo(room);

    (globalThis as any).__lkRoom = room;
    try { window.dispatchEvent(new CustomEvent("lk:attached")); } catch {}
    dcAttach(room);

    subscribeAllExisting(room);
    await requestPeerMetaTwice(room);

    const publishSrc = processedStreamRef.current ?? getLocalStream() ?? null;
    if (publishSrc) {
      applyLocalTrackStatesBeforePublish(publishSrc);
      for (const t of publishSrc.getTracks()) {
        try {
          await room.localParticipant.publishTrack(t);
        } catch {}
      }
    }
    try {
      const muted = !!lastMediaStateRef.current.remoteMuted;
      if (remoteAudioRef.current) remoteAudioRef.current.muted = muted;
      if (remoteVideoRef.current) remoteVideoRef.current.muted = muted;
    } catch {}
    setPhase("connected");
    broadcastMediaState();
    return true;
  }

  // timers
  useEffect(() => {
    if (rtcPhase !== "searching") return;
    const iv = setInterval(() => {
      const e = Date.now() - searchStartRef.current;
      if (e > 20000) setSearchMsg("Tip: try tweaking gender or countries for faster matches.");
      else if (e > 8000) setSearchMsg("Widening the search. Hang tight…");
    }, 500);
    return () => clearInterval(iv);
  }, [rtcPhase]);

  // boot + wiring
  useEffect(() => {
    (async () => {
      setPhase("boot");
      try {
        const s0 = await ensureLocalAliveLocal();

        try {
          const savedMic = readLSBool("ditona_mic_on", true);
          lastMediaStateRef.current.micOn = savedMic;
          const at = s0?.getAudioTracks?.()[0];
          if (at) at.enabled = savedMic;

          const savedRemoteMuted = readLSBool("ditona_remote_muted", false);
          lastMediaStateRef.current.remoteMuted = savedRemoteMuted;
        } catch {}

        if (localRef.current && s0) {
          if ((localRef.current as any).srcObject !== s0) {
            (localRef.current as any).srcObject = s0;
          }
          localRef.current.muted = true;
          await safePlay(localRef.current);
        }

        try {
          beautyOnRef.current = localStorage.getItem("ditona_beauty_on") === "1";
          const savedMask = (localStorage.getItem("ditona_mask_name") ?? localStorage.getItem("ditona_mask")) || "";
          if (savedMask && savedMask !== "null") {
            await setMask(savedMask).catch(() => {});
            effectsMaskOnRef.current = true;
          }
          setBeautyEnabled(!!beautyOnRef.current);
          if (beautyOnRef.current || effectsMaskOnRef.current) await ensureEffectsRunning();
        } catch {}

        setReady(true);
        broadcastMediaState();
        const sid = newSid();
        await joinViaRedisMatch(sid);
      } catch (error: any) {
        if (error?.name === "NotAllowedError") setCameraPermissionHint("Allow camera and microphone from browser settings");
        else if (error?.name === "NotReadableError" || error?.name === "AbortError")
          setCameraPermissionHint("Close the other tab/app using the camera");
        else if (error?.name === "NotFoundError") setCameraPermissionHint("No camera or microphone found");
        else setCameraPermissionHint("Camera access error — check permissions");
      }
    })().catch(() => {});

    const offs: Array<() => void> = [];

    // mic/cam
    offs.push(
      on("ui:toggleMic", () => {
        toggleMic();
        const v = !!getMicState();
        lastMediaStateRef.current.micOn = v;
        try {
          localStorage.setItem("ditona_mic_on", v ? "1" : "0");
        } catch {}
        broadcastMediaState();
      })
    );
    offs.push(on("ui:toggleCam", () => toggleCam()));

    // camera switch
    offs.push(
      on("ui:switchCamera", async () => {
        const ok = await switchCameraCycle(roomRef.current, localRef.current || undefined);
        if (!ok) toast("Camera switch failed");
        else {
          if (effectsOnRef.current) await ensureEffectsRunning().catch(() => {});
          broadcastMediaState();
        }
      })
    );

    // settings — لا نقطع الاتصال
    offs.push(on("ui:openSettings", () => { try { window.dispatchEvent(new CustomEvent("ui:settings:open")); } catch {} }));

    // torch
    offs.push(
      on("ui:toggleTorch", async () => {
        const ok = await toggleTorch();
        toast(ok ? "Flash toggled" : "Flash not supported");
        broadcastMediaState();
      })
    );

    // تعيين DID للطرف من الميتا
    const onPeerMetaCapture = (ev: any) => {
      try {
        const d = ev?.detail?.meta || ev?.detail || {};
        const did = d.did || d.deviceId || d.peerDid || d.id || d.identity;
        if (did) {
          remoteDidRef.current = String(did);
          (window as any).__ditonaPeerDid = remoteDidRef.current;
          (window as any).__peerDid = remoteDidRef.current;
        }
      } catch {}
    };
    window.addEventListener("ditona:peer-meta", onPeerMetaCapture as any);
    window.addEventListener("rtc:peer-meta", onPeerMetaCapture as any);
    offs.push(() => window.removeEventListener("ditona:peer-meta", onPeerMetaCapture as any));
    offs.push(() => window.removeEventListener("rtc:peer-meta", onPeerMetaCapture as any));

    // report
    offs.push(on("ui:report", () => toast("Report sent. Moving on")));

    // NEXT + اهتزاز
    offs.push(
      on("ui:next", async () => {
        vibrate(18);
        const now = Date.now();
        if (joiningRef.current || leavingRef.current || isConnectingRef.current || roomRef.current?.state === "connecting") return;
        if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
        lastNextTsRef.current = now;

        setPhase("searching");

        abortPolling();
        const sid = newSid();
        await leaveRoom({ bySwitch: true });
        await new Promise((r) => setTimeout(r, SWITCH_PAUSE_MS));

        const s1 = await ensureLocalAliveLocal();
        if (localRef.current && s1 && (localRef.current as any).srcObject !== s1) {
          (localRef.current as any).srcObject = s1;
          localRef.current.muted = true;
          await safePlay(localRef.current);
        }
        if (effectsOnRef.current) await ensureEffectsRunning().catch(() => {});

        await joinViaRedisMatch(sid);
      })
    );

    // PREV + اهتزاز
    offs.push(
      on("ui:prev", async () => {
        vibrate(18);
        if (!filters.isVip && !ffa) {
          toast("🔒 Going back is VIP only");
          emit("ui:upsell", "prev");
          return;
        }
        const now = Date.now();
        if (joiningRef.current || leavingRef.current || isConnectingRef.current || roomRef.current?.state === "connecting") return;
        if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
        lastNextTsRef.current = now;

        setPhase("searching");

        abortPolling();
        const sid = newSid();
        await leaveRoom({ bySwitch: true });
        await new Promise((r) => setTimeout(r, SWITCH_PAUSE_MS));

        const ok = await Promise.race<boolean>([
          (async () => await tryPrevReconnect())(),
          (async () => {
            await new Promise((r) => setTimeout(r, 7000));
            return false;
          })(),
        ]);

        if (!ok) {
          const s2 = await ensureLocalAliveLocal();
          if (localRef.current && s2 && (localRef.current as any).srcObject !== s2) {
            (localRef.current as any).srcObject = s2;
            localRef.current.muted = true;
            await safePlay(localRef.current);
          }
          if (effectsOnRef.current) await ensureEffectsRunning().catch(() => {});
          await joinViaRedisMatch(sid);
        }
      })
    );

    // messaging
    offs.push(on("ui:openMessaging" as any, () => setShowMessaging(true)));
    offs.push(on("ui:closeMessaging" as any, () => setShowMessaging(false)));

    // remote audio toggle
    offs.push(
      on("ui:toggleRemoteAudio" as any, () => {
        const a = remoteAudioRef.current;
        const v = remoteVideoRef.current;
        const target: any = a ?? v;
        if (target) {
          target.muted = !target.muted;
          lastMediaStateRef.current.remoteMuted = target.muted;
          try {
            localStorage.setItem("ditona_remote_muted", target.muted ? "1" : "0");
          } catch {}
          broadcastMediaState();
          toast(target.muted ? "Remote muted" : "Remote unmuted");
        }
      })
    );

    // Beauty/Masks
    offs.push(on("ui:toggleBeauty", async (d: any) => { await enableBeauty(!!d?.enabled).catch(() => {}); }));
    offs.push(on("ui:toggleMasks", async () => { const next = !effectsMaskOnRef.current; if (next) await enableMask("cat"); else await enableMask(null); }));
    offs.push(on("ui:setMask", async (d: any) => { await enableMask(d?.name ?? null); }));

    // mirror
    offs.push(
      on("ui:toggleMirror", () =>
        setIsMirrored((prev) => {
          const s = !prev;
          toast(s ? "Mirror on" : "Mirror off");
          return s;
        })
      )
    );

    // upsell
    offs.push(on("ui:upsell", (d: any) => { if (ffa) return; router.push(`/plans?ref=${d?.ref || d?.feature || "generic"}`); }));

    // mask tray
    offs.push(on("ui:openMaskTray", () => setMaskOpen(true)));
    offs.push(on("ui:closeMaskTray", () => setMaskOpen(false)));
    offs.push(on("ui:toggleMaskTray", () => setMaskOpen((v) => !v)));

    // Cancel (لا نغلق الكاميرا)
    offs.push(on("ui:cancel", () => { abortPolling(); setPhase("searching"); }));

    const mobileOptimizer = getMobileOptimizer();
    const unsubMob = mobileOptimizer.subscribe(() => {});

    return () => {
      for (const off of offs) try { off(); } catch {}
      unsubMob();
      try { if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current); } catch {}
      abortPolling();
      try { tokenAbortRef.current?.abort(); } catch {}
      disableAllEffects().catch(() => {});
      leaveRoom().catch(() => {});
    };
    // اتصال الحالي لا يُقطع بتغيير الفلاتر/الإعدادات
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    emit(maskOpen ? "ui:maskTrayOpen" : "ui:maskTrayClose");
  }, [maskOpen]);

  return (
    <>
      <div className="min-h-[100dvh] h-[100dvh] w-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100" data-chat-container>
        <div className="h-full grid grid-rows-2 gap-2 p-2">
          {/* ===== Remote pane (B) ===== */}
          <section className="relative isolation-isolate rounded-2xl bg-black/30 overflow-hidden" data-pane="remote">
            {/* Video at the bottom layer */}
            <video
              ref={remoteVideoRef}
              id="remoteVideo"
              data-role="remote"
              className="absolute inset-0 z-0 w-full h-full object-cover"
              playsInline
              autoPlay
            />
            <audio ref={remoteAudioRef} id="remoteAudio" autoPlay playsInline hidden />

            {/* HUD layers above video */}
            <div className="pointer-events-none absolute inset-0 z-40">
              <FilterBar />
              <MessageHud />
              <PeerOverlay />
              {/* make Like clickable even with the HUD shell non-interactive */}
              <div className="absolute bottom-4 right-4 pointer-events-auto">
                <LikeSystem />
              </div>
            </div>

            {rtcPhase === "searching" && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
                <div className="mb-4">{searchMsg}</div>
                <button
                  onClick={() => emit("ui:cancel")}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* ===== Local pane (A) ===== */}
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
                              if ((localRef.current as any).srcObject !== s) {
                                (localRef.current as any).srcObject = s;
                              }
                              localRef.current.muted = true;
                              await safePlay(localRef.current);
                              setReady(true);
                              broadcastMediaState();
                              const sid = newSid();
                              joinViaRedisMatch(sid).catch(() => {});
                            }
                          })
                          .catch((error) => {
                            if ((error as any)?.name === "NotAllowedError") setCameraPermissionHint("Allow camera and microphone from browser settings");
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
          <UpsellModal open={showUpsell} onClose={() => setShowUpsell(false)} />
          <ChatMessagingBar />
        </div>
      </div>

      <MaskTray open={maskOpen} onClose={() => setMaskOpen(false)} />
    </>
  );
}
