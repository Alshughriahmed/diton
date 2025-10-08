// Resilient search loop + Perfect Negotiation + safe teardown/retry
"use client";

import apiSafeFetch from "@/app/chat/safeFetch";
import { rtcHeaders, markLastStopTs } from "@/app/chat/rtcHeaders.client";

export type Phase = "idle" | "searching" | "matched" | "connected" | "stopped";
type Role = "caller" | "callee";

type State = {
  sid: number;
  phase: Phase;
  pairId: string | null;
  role: Role | null;
  ac: AbortController | null;
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  remoteStream: MediaStream | null;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  polite: boolean;
  lastPeer: string | null;
};

let state: State = {
  sid: 0,
  phase: "idle",
  pairId: null,
  role: null,
  ac: null,
  pc: null,
  dc: null,
  remoteStream: null,
  makingOffer: false,
  ignoreOffer: false,
  isSettingRemoteAnswerPending: false,
  polite: false,
  lastPeer: null,
};

let onPhaseCallback: ((p: Phase) => void) | null = null;
let cooldownNext = false;

/* utils */
const isAbort = (e: any) => e && (e.name === "AbortError" || e.code === 20);
const swallowAbort = (e: any) => { if (!isAbort(e)) console.warn("[rtc] non-abort error:", e); };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const checkSession = (sid: number) => state.sid === sid;
const hasPair = () => Boolean(state.pairId && state.role);
function safeAbort(ac?: AbortController | null) { try { if (ac && !ac.signal.aborted) ac.abort("stop"); } catch {} }
function logRtc(event: string, code: number, extra?: Record<string, unknown>) {
  try { console.log("[rtc]", event, code, extra || {}); } catch {}
}
function getUserAttrs() {
  const gender = localStorage.getItem("ditona_gender") || "u";
  const country = localStorage.getItem("ditona_country") || "XX";
  const filterGenders = localStorage.getItem("ditona_filterGenders") || "all";
  const filterCountries = localStorage.getItem("ditona_filterCountries") || "ALL";
  const vip = localStorage.getItem("ditona_vip") === "1" ? 1 : 0;
  return { gender, country, filterGenders, filterCountries, vip };
}

async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const r = await apiSafeFetch("/api/turn", { method: "GET", cache: "no-store" });
    if (r?.ok) {
      const j = await r.json().catch(() => ({}));
      if (Array.isArray(j?.iceServers)) return j.iceServers as RTCIceServer[];
    }
  } catch {}
  return [];
}

/* perfect negotiation helpers */
function wirePerfect(pc: RTCPeerConnection) {
  pc.onnegotiationneeded = async () => {
    if (!state.pc || !hasPair() || !checkSession(state.sid)) return;
    try {
      state.makingOffer = true;
      const offer = await state.pc.createOffer();
      await state.pc.setLocalDescription(offer);
      if (state.role === "caller") {
        await apiSafeFetch("/api/rtc/offer", {
          method: "POST",
          headers: { "content-type": "application/json", ...rtcHeaders({ pairId: state.pairId!, role: state.role! }) },
          body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(offer) }),
        }).catch(swallowAbort);
      }
    } catch (e) {
      logRtc("onnegotiationneeded", 500, { error: String((e as any)?.message || e) });
    } finally {
      state.makingOffer = false;
    }
  };

  pc.onicecandidate = async (e) => {
    if (!e.candidate || !checkSession(state.sid) || state.ac?.signal.aborted) return;
    if (!hasPair()) return;
    await apiSafeFetch("/api/rtc/ice", {
      method: "POST",
      headers: { "content-type": "application/json", ...rtcHeaders({ pairId: state.pairId!, role: state.role! }) },
      body: JSON.stringify({ pairId: state.pairId, candidate: e.candidate }),
    }).catch(swallowAbort);
  };
}

/* ICE polling */
async function iceExchange(sessionId: number) {
  let backoff = 300;
  while (checkSession(sessionId) && !state.ac?.signal?.aborted && hasPair()) {
    const r = await apiSafeFetch(`/api/rtc/ice?pairId=${encodeURIComponent(state.pairId!)}`, {
      method: "GET",
      cache: "no-store",
      headers: { ...rtcHeaders({ pairId: state.pairId!, role: state.role! }) },
    }).catch(() => null);
    if (!r || !checkSession(sessionId)) break;
    if (r.status === 200) {
      const items = await r.json().catch(() => []);
      if (Array.isArray(items)) {
        for (const it of items) {
          const cand = it?.cand || it?.candidate || it;
          try { await state.pc?.addIceCandidate(cand); }
          catch (e) { logRtc("ice-add-error", 500, { error: String(e) }); }
        }
      }
    }
    await sleep(backoff + Math.floor(Math.random() * 200));
    backoff = Math.min(backoff * 1.5, 1500);
  }
}

/* caller/callee flows */
async function callerFlow(sessionId: number) {
  if (!checkSession(sessionId) || !state.pc || state.role !== "caller" || !state.pairId) return;

  let backoff = 350;
  for (let i = 0; i < 90 && checkSession(sessionId) && !state.ac?.signal?.aborted; i++) {
    const r = await apiSafeFetch(`/api/rtc/answer?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      cache: "no-store",
      headers: { ...rtcHeaders({ pairId: state.pairId!, role: state.role! }) },
    }).catch(() => null);
    if (!r || !checkSession(sessionId)) return;

    if (r.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        const desc = JSON.parse(String(sdp));
        await state.pc!.setRemoteDescription(desc).catch(e => logRtc("setRemoteAnswer", 500, { e: String(e) }));
        return;
      }
    }
    await sleep(backoff + Math.floor(Math.random() * 250));
    backoff = Math.min(backoff * 1.3, 1200);
  }
}

async function calleeFlow(sessionId: number) {
  if (!checkSession(sessionId) || !state.pc || state.role !== "callee" || !state.pairId) return;

  let backoff = 350;
  for (let i = 0; i < 90 && checkSession(sessionId) && !state.ac?.signal?.aborted; i++) {
    const r = await apiSafeFetch(`/api/rtc/offer?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      cache: "no-store",
      headers: { ...rtcHeaders({ pairId: state.pairId!, role: state.role! }) },
    }).catch(() => null);
    if (!r || !checkSession(sessionId)) return;

    if (r.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        const offer = JSON.parse(String(sdp));
        try {
          const offerCollision = offer?.type === "offer" && (state.makingOffer || state.pc!.signalingState !== "stable");
          state.ignoreOffer = !state.polite && offerCollision;
          if (!state.ignoreOffer) {
            if (offerCollision) { try { await state.pc!.setLocalDescription({ type: "rollback" } as any); } catch {} }
            await state.pc!.setRemoteDescription(offer);
            const answer = await state.pc!.createAnswer();
            await state.pc!.setLocalDescription(answer);
            await apiSafeFetch("/api/rtc/answer", {
              method: "POST",
              headers: { "content-type": "application/json", ...rtcHeaders({ pairId: state.pairId!, role: state.role! }) },
              body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(answer) }),
            }).catch(swallowAbort);
          }
        } catch (e) { logRtc("calleeFlow-error", 500, { e: String(e) }); }
        return;
      }
    }
    await sleep(backoff + Math.floor(Math.random() * 250));
    backoff = Math.min(backoff * 1.3, 1200);
  }
}

/* public API */
export async function start(media: MediaStream | null, onPhase: (phase: Phase) => void) {
  try {
    stop(); // guard
    const currentSession = ++state.sid;
    onPhaseCallback = onPhase;

    state.phase = "searching";
    try { onPhase("searching"); } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "searching", role: null } }));
    }

    state.ac = new AbortController();
    logRtc("flow-start", 200);

    // 1) init anon cookie
    try {
      await apiSafeFetch("/api/anon/init", { method: "GET", cache: "no-store", signal: state.ac?.signal });
    } catch (e) { swallowAbort(e); }

    // 2) enqueue مع الخصائص
    const HEnq = rtcHeaders({});
    await apiSafeFetch("/api/rtc/enqueue", {
      method: "POST",
      headers: { "content-type": "application/json", ...HEnq },
      body: JSON.stringify(getUserAttrs()),
    }).catch(swallowAbort);

    // 3) matchmake polling: لا تتوقف عند 204 — وعند 400 أعد enqueue
    while (checkSession(currentSession) && !state.ac?.signal?.aborted) {
      const r = await apiSafeFetch("/api/rtc/matchmake", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json", ...rtcHeaders({}) },
        body: JSON.stringify({}),
      }).catch(() => null);

      if (!r || !checkSession(currentSession)) return;

      if (r.status === 400) {
        // نقص attrs على الخادم → أعد enqueue بالخصائص
        await apiSafeFetch("/api/rtc/enqueue", {
          method: "POST",
          headers: { "content-type": "application/json", ...rtcHeaders({}) },
          body: JSON.stringify(getUserAttrs()),
        }).catch(swallowAbort);
        await sleep(600);
        continue;
      }

      if (r.status === 204) {
        state.phase = "searching";
        try { onPhase("searching"); } catch {}
        await sleep(900);
        continue;
      }

      if (r.status === 200) {
        const j = await r.json().catch(() => ({} as any));
        const pid = j?.pairId;
        const role = j?.role as Role | undefined;
        if (pid && role) {
          state.pairId = pid;
          state.role = role;
          state.polite = role === "callee";
          state.makingOffer = false;
          state.ignoreOffer = false;
          state.isSettingRemoteAnswerPending = false;

          try { (globalThis as any).__ditonaSetPair?.(state.pairId, state.role); } catch {}
          if (j.peerAnonId) state.lastPeer = j.peerAnonId;

          state.phase = "matched";
          try { onPhase("matched"); } catch {}
          if (typeof window !== "undefined") {
            window.localStorage.setItem("ditona_pair", state.pairId!);
            window.localStorage.setItem("ditona_role", state.role!);
            window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId: state.pairId, role: state.role } }));
            window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "matched", role: state.role } }));
            window.dispatchEvent(new CustomEvent("ditona:chat:reset"));
            window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked: false } }));
          }
          break;
        }
      }

      await sleep(900);
    }

    if (!hasPair() || !checkSession(currentSession)) { stop(); return; }

    // 4) PC + TURN
    const iceServers = await getIceServers();
    state.pc = new RTCPeerConnection({ iceServers });
    wirePerfect(state.pc);

    // remote media
    state.pc.ontrack = (ev) => {
      if (!checkSession(currentSession)) return;
      const stream = ev.streams?.[0] || new MediaStream([ev.track]);
      state.remoteStream = stream;
      if (typeof window !== "undefined") {
        const el = document.getElementById("remoteVideo") as HTMLVideoElement | null;
        if (el) { el.srcObject = stream; el.muted = true; el.playsInline = true; (el as any).autoplay = true; el.play?.().catch(() => {}); }
        window.dispatchEvent(new CustomEvent("rtc:remote-track", { detail: { stream } }));
      }
      logRtc("track-received", 200);
    };

    // local media
    if (media) { media.getTracks().forEach(tr => state.pc?.addTrack(tr, media)); }

    // 5) ICE + SDP flows
    void iceExchange(currentSession);
    if (state.role === "caller") await callerFlow(currentSession);
    else await calleeFlow(currentSession);

    // connection state → connected
    state.pc.onconnectionstatechange = () => {
      if (!checkSession(currentSession) || !state.pc) return;
      const cs = state.pc.connectionState;
      logRtc("connection-state", 200, { connectionState: cs });
      if (cs === "connected") {
        state.phase = "connected";
        try { onPhase("connected"); } catch {}
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "connected", role: state.role } }));
      } else if (cs === "disconnected" || cs === "failed") {
        // يمكن لاحقًا إضافة restartIce/backoff
      } else if (cs === "closed") {
        stop();
      }
    };

    if (typeof window !== "undefined") { (window as any).ditonaPC = state.pc; }
  } catch (e: any) {
    if (isAbort(e)) logRtc("flow-aborted", 499);
    else { logRtc("flow-error", 500, { error: e?.message || String(e) }); }
    stop();
  }
}

export function stop(mode: "full" | "network" = "full") {
  try { markLastStopTs(); } catch {}
  try { (globalThis as any).__ditonaSetPair?.(undefined, state.role); } catch {}
  try { safeAbort(state.ac); } catch {}
  state.ac = null;

  try {
    if (mode !== "full") {
      try { state.pc?.close(); } catch {}
      state.pc = null;
      try { state.remoteStream?.getTracks().forEach(t => t.stop()); } catch {}
      state.remoteStream = null;
      logRtc("stop", 206);
    } else {
      try { state.pc?.getSenders?.().forEach(s => { try { s.replaceTrack(null); } catch {} }); } catch {}
      try { state.pc?.close(); } catch {}
      state.pc = null;
      try { state.remoteStream?.getTracks().forEach(t => t.stop()); } catch {}
      state.remoteStream = null;
      state.pairId = null;
      state.role = null;
      state.phase = "idle";
      try { onPhaseCallback?.("idle"); } catch {}
      logRtc("stop", 200);
    }
  } catch {}
}

export async function next() {
  if (cooldownNext) return;
  cooldownNext = true;
  try {
    try { stop("network"); } catch {}
    try { window?.localStorage?.removeItem("ditona_pair"); } catch {}
    await sleep(700);
    if (onPhaseCallback) await start(null, onPhaseCallback);
  } finally { cooldownNext = false; }
}

export async function prev() { return next(); }
