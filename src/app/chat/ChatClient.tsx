// src/app/chat/ChatClient.tsx
"use client";
import safeFetch from '@/app/chat/safeFetch';
import "@/app/chat/metaInit.client";
import "@/app/chat/peerMetaUi.client";
import "./freeForAllBridge";
import "./dcMetaResponder.client";
import "./likeSyncClient";
import "./msgSendClient";

import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";
import { initLocalMedia, getLocalStream, toggleMic, toggleCam, switchCamera } from "@/lib/media";
import { useFilters } from "@/state/filters";
import { useProfile } from "@/state/profile";
import { useHydrated } from "@/hooks/useHydrated";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGestures } from "@/hooks/useGestures";
import { toast } from "@/lib/ui/toast";

import { Room, RoomEvent, RemoteTrackPublication, Track, RemoteParticipant, RemoteTrack } from "livekit-client";

type Phase = "idle"|"searching"|"matched"|"connected"|"stopped";
const NEXT_COOLDOWN_MS = 700;

function stableDid(): string {
  try {
    const k = "ditona_did";
    let v = localStorage.getItem(k);
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
    return v;
  } catch { return "did-"+Math.random().toString(36).slice(2,10); }
}
function identity(displayName?: string): string {
  const n = (displayName||"anon").trim() || "anon";
  return `${n}#${stableDid().slice(0,6)}`;
}

async function enqueueReq(body: any){
  const r = await fetch("/api/match/enqueue", {
    method:"POST", credentials:"include", cache:"no-store",
    headers:{ "content-type":"application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("enqueue failed "+r.status);
  const j = await r.json(); return j.ticket as string;
}
async function nextReq(ticket: string){
  const r = await fetch(`/api/match/next?ticket=${encodeURIComponent(ticket)}&wait=8000`, {
    credentials:"include", cache:"no-store"
  });
  if (r.status === 204) return null;
  if (!r.ok) throw new Error("next failed "+r.status);
  const j = await r.json(); return j.room as string;
}
async function tokenReq(room: string, id: string){
  const r = await fetch(`/api/livekit/token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(id)}`, {
    credentials:"include", cache:"no-store"
  });
  if (!r.ok) throw new Error("token failed "+r.status);
  const j = await r.json(); return j.token as string;
}

export default function ChatClient(){
  const hydrated = useHydrated();
  useKeyboardShortcuts();
  useGestures();

  const { isVip: vip, gender, countries } = useFilters();
  const { profile } = useProfile();

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const lkRoomRef = useRef<Room|null>(null);
  const joiningRef = useRef(false);
  const lastNextTsRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [rtcPhase, setRtcPhase] = useState<Phase>("idle");
  const [isMirrored, setIsMirrored] = useState(true);
  const [like, setLike] = useState(false);

  function exposeCompatDC(room: Room){
    (globalThis as any).__lkRoom = room;
    (globalThis as any).__ditonaDataChannel = {
      readyState: "open",
      send: (s: string|ArrayBuffer|Uint8Array) => {
        const u8 = typeof s==="string" ? new TextEncoder().encode(s) : (s instanceof Uint8Array ? s : new Uint8Array(s as any));
        try { room.localParticipant.publishData(u8, { reliable:true }); } catch {}
      }
    };
  }

  async function leaveRoom(){
    const r = lkRoomRef.current; lkRoomRef.current = null;
    try { (globalThis as any).__lkRoom = null; r?.disconnect(true); } catch {}
  }

  async function joinViaRedisMatch(){
    if (joiningRef.current) return;
    joiningRef.current = true;
    setRtcPhase("searching"); emit("rtc:phase",{phase:"searching"});

    try{
      // 1) enqueue
      let selfCountry: string | null = null;
      try { const g = JSON.parse(localStorage.getItem("ditona_geo")||"null"); if (g?.country) selfCountry = String(g.country).toUpperCase(); } catch {}
      const myId = identity(profile?.displayName);
      const ticket = await enqueueReq({
        identity: myId,
        deviceId: stableDid(),
        vip: !!vip,
        selfGender: (profile?.gender==="male"||profile?.gender==="female")?profile.gender:"u",
        selfCountry,
        filterGenders: (gender==="male"||gender==="female")?gender:"all",
        filterCountries: (countries?.length? countries : [])
      });

      // 2) poll next
      let roomName: string | null = null;
      for (let i=0; i<3 && !roomName; i++){
        roomName = await nextReq(ticket);
      }
      if (!roomName) { setRtcPhase("stopped"); emit("rtc:phase",{phase:"stopped"}); return; }

      // 3) connect
      const room = new Room({ adaptiveStream:true, dynacast:true });
      lkRoomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, ()=>{
        setRtcPhase("matched"); emit("rtc:phase",{phase:"matched"});
        try { window.dispatchEvent(new CustomEvent("rtc:pair",{ detail:{ pairId: roomName } })); } catch {}
      });
      room.on(RoomEvent.TrackSubscribed, (_t:RemoteTrack, pub:RemoteTrackPublication, _p:RemoteParticipant)=>{
        try{
          if (pub.kind===Track.Kind.Video && pub.track && remoteRef.current) {
            const ms = new MediaStream([pub.track.mediaStreamTrack]); remoteRef.current.srcObject = ms as any;
            remoteRef.current.play?.().catch(()=>{});
            window.dispatchEvent(new CustomEvent("rtc:remote-track",{ detail:{ stream: ms } }));
          }
          if (pub.kind===Track.Kind.Audio && pub.track && remoteAudioRef.current) {
            const ms = new MediaStream([pub.track.mediaStreamTrack]); remoteAudioRef.current.srcObject = ms as any;
            remoteAudioRef.current.muted=false; remoteAudioRef.current.play?.().catch(()=>{});
          }
          setRtcPhase("connected"); emit("rtc:phase",{phase:"connected"});
        }catch{}
      });
      room.on(RoomEvent.DataReceived, (payload)=>{
        try{
          const msg = new TextDecoder().decode(payload);
          const j = /^\s*\{/.test(msg) ? JSON.parse(msg) : null;
          if (j?.t==="chat" && j.text) window.dispatchEvent(new CustomEvent("ditona:chat:recv",{ detail:{ text:j.text, pairId: roomName } }));
          if (j?.t==="peer-meta" && j.payload) window.dispatchEvent(new CustomEvent("ditona:peer-meta",{ detail:j.payload }));
          if (j?.t==="like" || j?.type==="like:toggled") window.dispatchEvent(new CustomEvent("ditona:like:recv",{ detail:{ pairId: roomName } }));
        }catch{}
      });
      room.on(RoomEvent.ParticipantDisconnected, ()=>{
        if (room.participants.size===0){ setRtcPhase("searching"); emit("rtc:phase",{phase:"searching"}); }
      });
      room.on(RoomEvent.Disconnected, ()=>{
        setRtcPhase("stopped"); emit("rtc:phase",{phase:"stopped"});
      });

      const token = await tokenReq(roomName, myId);
      const ws = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL!;
      await room.connect(ws, token);
      exposeCompatDC(room);

      const src = getLocalStream();
      if (src) for (const t of src.getTracks()) { try { await room.localParticipant.publishTrack(t); } catch {} }

    } finally {
      joiningRef.current = false;
    }
  }

  useEffect(()=>{ (async ()=>{
    if (!hydrated) return;
    try{
      const s = await initLocalMedia();
      if (s && localRef.current){ localRef.current.srcObject = s; localRef.current.muted = true; await localRef.current.play().catch(()=>{}); }
      setReady(true);
      emit("rtc:phase",{phase:"boot"});
      await safeFetch("/api/age/allow",{ method:"POST", credentials:"include", cache:"no-store" }).catch(()=>{});
      await joinViaRedisMatch();
    }catch(e){ console.warn("boot failed", e); }
  })(); },[hydrated]);

  useEffect(()=>{
    const offMic = on("ui:toggleMic", ()=> toggleMic());
    const offCam = on("ui:toggleCam", ()=> toggleCam());
    const offSwitch = on("ui:switchCamera", async ()=>{
      try{
        const newStream = await switchCamera();
        if (localRef.current && newStream) { localRef.current.srcObject = newStream; localRef.current.play().catch(()=>{}); }
        const room = lkRoomRef.current;
        if (room) {
          try {
            const pubs = Array.from((room.localParticipant as any).trackPublications?.values?.() ?? []);
            for (const pub of pubs) { const tr: any = (pub as any).track; if (tr) (room.localParticipant as any).unpublishTrack(tr); }
            for (const t of newStream.getTracks()) { await room.localParticipant.publishTrack(t); }
          } catch {}
        }
      }catch(e){ console.warn("switchCamera failed", e); }
    });
    const offLike = on("ui:like", async ()=>{
      const room = lkRoomRef.current; if (!room) { toast("No active connection for like"); return; }
      const newLike = !like; setLike(newLike);
      try { const payload = new TextEncoder().encode(JSON.stringify({ t:"like", liked:newLike })); await (room.localParticipant as any).publishData(payload,{ reliable:true, topic:"like" }); } catch {}
      toast(`Like ${newLike ? "❤️" : "💔"}`);
    });
    const offNext = on("ui:next", async ()=>{
      const now = Date.now(); if (now - lastNextTsRef.current < NEXT_COOLDOWN_MS) return;
      lastNextTsRef.current = now; toast("⏭️ Next");
      await leaveRoom(); await joinViaRedisMatch();
    });
    const offPrev = on("ui:prev", ()=>{ /* VIP-gated elsewhere */ });

    return ()=>{ offMic(); offCam(); offSwitch(); offLike(); offNext(); offPrev(); };
  },[like]);

  return (
    <>
      <div className="min-h-[100dvh] h-[100dvh] w-full" data-chat-container>
        <div className="h-full grid grid-rows-2 gap-2 p-2">
          <section className="relative rounded-2xl bg-black/30 overflow-hidden">
            <video ref={remoteRef} id="remoteVideo" data-role="remote" className="w-full h-full object-cover" playsInline autoPlay />
            <audio ref={remoteAudioRef} id="remoteAudio" autoPlay playsInline hidden />
            {rtcPhase === "searching" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300/80 text-sm select-none">
                <div className="mb-4">Searching for a partner…</div>
                <button onClick={() => toast("🛑 Search cancelled")} className="px-4 py-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg text-white font-medium transition-colors duration-200 pointer-events-auto">Cancel</button>
              </div>
            )}
          </section>
          <section className="relative rounded-2xl bg-black/20 overflow-hidden">
            <video ref={localRef} data-local-video className={`w-full h-full object-cover ${isMirrored ? "scale-x-[-1]" : ""}`} playsInline muted autoPlay />
          </section>
        </div>
      </div>
    </>
  );
}
