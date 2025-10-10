// src/app/chat/rtcFlow.ts
// Robust PN + attrs enqueue + idempotent signaling + teardown/backoff

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
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
  ac?: AbortController;
};

const state: State = {
  sid: 0,
  phase: "idle",
  pairId: null,
  role: null,
  pc: null,
  dc: null,
  makingOffer: false,
  ignoreOffer: false,
  polite: false,
  ac: undefined,
};

let onPhaseCallback: (p: Phase) => void = () => {};
let cooldownNext = false;

// TURN/ICE config comes from server when needed. Keep empty here.
const ICE_SERVERS: RTCConfiguration = { iceServers: [] };

// ---------- utils ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isAbort = (e: any) => e?.name === "AbortError";
const swallowAbort = (e: any) => { if (!isAbort(e)) console.warn(e); };
const checkSession = (sid: number) => sid === state.sid;

function sdpTagOf(sdp: string, kind: "offer" | "answer") {
  try {
    let x = 0;
    for (let i = 0; i < Math.min(512, sdp.length); i++) x = (x * 33 + sdp.charCodeAt(i)) | 0;
    return `${kind}:${sdp.length}:${(x >>> 0).toString(36)}`;
  } catch { return `${kind}:${sdp.length}:0`; }
}

function emitPhase(phase: Phase) {
  state.phase = phase;
  try { onPhaseCallback(phase); } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase } }));
  }
}

function emitPair(pairId: string, role: Role) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId, role } }));
  }
}

function emitRemoteTrack(stream: MediaStream) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rtc:remote-track", { detail: { stream } }));
  }
}

// ---------- enqueue + matchmaking ----------
async function ensureEnqueue() {
  const body = {
    gender: "u",
    country: "XX",
    filterGenders: "all",
    filterCountries: "ALL",
  };
  await apiSafeFetch("/api/rtc/enqueue", {
    method: "POST",
    headers: { "content-type": "application/json", ...rtcHeaders() },
    body: JSON.stringify(body),
    timeoutMs: 6000,
  }).catch(swallowAbort);
}

async function pollMatchmake(ac: AbortController) {
  let back = 400;
  for (;;) {
    if (ac.signal.aborted) throw new DOMException("aborted", "AbortError");

    const r = await apiSafeFetch("/api/rtc/matchmake", {
      method: "GET",
      headers: rtcHeaders(),
      timeoutMs: 6000,
    }).catch(swallowAbort);

    if (r?.status === 200) {
      try {
        const j = await r.json();
        if (j?.pairId && j?.role) return j as { pairId: string; role: Role; peerAnonId?: string };
      } catch {}
    } else if (r?.status === 400) {
      // attrs-missing الحقيقي → أعد enqueue ثم تابع
      await ensureEnqueue();
    }
    await sleep(back + Math.floor(Math.random() * 150));
    back = Math.min(back * 1.3, 1400);
  }
}

// ---------- Perfect Negotiation wiring ----------
function attachPnHandlers(pc: RTCPeerConnection, sessionId: number) {
  // remote track to UI
  pc.ontrack = (ev) => {
    const [stream] = ev.streams;
    if (stream) emitRemoteTrack(stream);
  };

  pc.onnegotiationneeded = async () => {
    if (!checkSession(sessionId)) return;
    if (state.ac?.signal.aborted) return;
    if (!state.pc || state.role !== "caller") return;

    try {
      state.makingOffer = true;
      const offer = await state.pc.createOffer();
      await state.pc.setLocalDescription(offer);

      // POST /offer idempotent via x-ditona-sdp-tag
      const body = { pairId: state.pairId, sdp: JSON.stringify(offer) };
      await apiSafeFetch("/api/rtc/offer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ditona-sdp-tag": sdpTagOf(JSON.stringify(offer), "offer"),
          ...rtcHeaders({ pairId: state.pairId!, role: state.role! }),
        },
        body: JSON.stringify(body),
        timeoutMs: 8000,
      }).catch(swallowAbort);
    } catch (e) {
      console.warn("negotiationneeded error", e);
    } finally {
      state.makingOffer = false;
    }
  };

  pc.onicecandidate = async (e) => {
    if (!e.candidate) return;
    if (!checkSession(sessionId) || state.ac?.signal.aborted) return;
    if (!state.pairId || !state.role) return;

    await apiSafeFetch("/api/rtc/ice", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...rtcHeaders({ pairId: state.pairId, role: state.role }),
      },
      body: JSON.stringify({ pairId: state.pairId, role: state.role, candidate: e.candidate }),
    }).catch(swallowAbort);
  };
}

// pull ICE from server
async function iceExchange(sessionId: number) {
  let backoff = 300;
  while (checkSession(sessionId) && !state.ac?.signal?.aborted && state.pairId && state.role) {
    const r = await apiSafeFetch(`/api/rtc/ice?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      cache: "no-store",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 6000,
    }).catch(swallowAbort);

    if (r?.status === 200) {
      const items = await r.json().catch(() => ([]));
      for (const cand of Array.isArray(items) ? items : []) {
        try { await state.pc!.addIceCandidate(cand); } catch (e) { console.warn("addIceCandidate", e); }
      }
      backoff = 300;
    }
    await sleep(backoff + Math.floor(Math.random() * 250));
    backoff = Math.min(backoff * 1.3, 1200);
  }
}

// caller waits for answer
async function callerFlow(sessionId: number) {
  let back = 400;
  while (checkSession(sessionId) && state.pairId && state.role === "caller") {
    const r = await apiSafeFetch(`/api/rtc/answer?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 6000,
    }).catch(swallowAbort);

    if (r?.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        try {
          const desc = JSON.parse(String(sdp));
          await state.pc!.setRemoteDescription(desc);
          return;
        } catch (e) { console.warn("caller setRemoteDescription", e); }
      }
    }
    await sleep(back);
    back = Math.min(back * 1.3, 1500);
  }
}

// callee pulls offer and posts answer
async function calleeFlow(sessionId: number) {
  let back = 400;
  while (checkSession(sessionId) && state.pairId && state.role === "callee") {
    const r = await apiSafeFetch(`/api/rtc/offer?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 6000,
    }).catch(swallowAbort);

    if (r?.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        const offer = JSON.parse(String(sdp));
        try {
          const offerCollision = offer?.type === "offer" && (state.makingOffer || state.pc!.signalingState !== "stable");
          state.ignoreOffer = !state.polite && offerCollision;

          if (!state.ignoreOffer) {
            if (offerCollision) {
              try { await state.pc!.setLocalDescription({ type: "rollback" } as any); } catch {}
            }
            await state.pc!.setRemoteDescription(offer);
            const answer = await state.pc!.createAnswer();
            await state.pc!.setLocalDescription(answer);

            await apiSafeFetch("/api/rtc/answer", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-ditona-sdp-tag": sdpTagOf(JSON.stringify(answer), "answer"),
                ...rtcHeaders({ pairId: state.pairId!, role: state.role! }),
              },
              body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(answer) }),
              timeoutMs: 8000,
            }).catch(swallowAbort);
          }
          return;
        } catch (e) { console.warn("calleeFlow", e); }
      }
    }
    await sleep(back);
    back = Math.min(back * 1.3, 1500);
  }
}

// ---------- public API ----------
export async function start(
  media: MediaStream | null,
  onPhase: (phase: Phase) => void
) {
  try {
    // guard
    stop();

    onPhaseCallback = onPhase;
    state.sid = (state.sid + 1) | 0;
    emitPhase("searching");
    state.ac = new AbortController();

    // ensure attrs in queue
    await ensureEnqueue();

    // find pair
    const mm = await pollMatchmake(state.ac);
    if (!mm?.pairId || !mm?.role) throw new Error("no-pair");

    state.pairId = mm.pairId;
    state.role = mm.role;
    state.polite = state.role === "callee";
    emitPhase("matched");
    emitPair(state.pairId, state.role);

    // RTCPeerConnection
    state.pc = new RTCPeerConnection(ICE_SERVERS);

    // local tracks
    if (media) for (const track of media.getTracks()) state.pc.addTrack(track, media);

    // remote track emission
    state.pc.ontrack = (ev) => { const [stream] = ev.streams; if (stream) emitRemoteTrack(stream); };

    // PN + ICE handlers
    attachPnHandlers(state.pc, state.sid);

    // ICE polling
    iceExchange(state.sid).catch(swallowAbort);

    // role-specific signaling
    if (state.role === "caller") await callerFlow(state.sid);
    else await calleeFlow(state.sid);

    // connection state wiring
    state.pc.onconnectionstatechange = () => {
      if (!checkSession(state.sid) || !state.pc) return;
      const cs = state.pc.connectionState;
      if (cs === "connected") {
        emitPhase("connected");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ditona:phase", { detail: { phase: "connected", role: state.role } }));
        }
      } else if (cs === "closed") {
        stop();
      }
    };

    if (typeof window !== "undefined") { (window as any).ditonaPC = state.pc; }
    return { pairId: state.pairId, role: state.role };
  } catch (e: any) {
    if (!isAbort(e)) console.warn("rtcFlow.start error", e);
    stop();
    return undefined;
  }
}

export function stop(mode: "full" | "network" = "full") {
  try { markLastStopTs(); } catch {}
  try { state.ac?.abort(); } catch {}
  state.ac = undefined;

  try { state.dc?.close(); } catch {} finally { state.dc = null; }
  try { state.pc?.close(); } catch {} finally { state.pc = null; }

  if (mode === "full") {
    state.pairId = null;
    state.role = null;
    emitPhase("stopped");
  }
}

export async function next() {
  if (cooldownNext) return;
  cooldownNext = true;
  try {
    try { stop("network"); } catch {}
    try { window?.localStorage?.removeItem("ditona_pair"); } catch {}
    await sleep(700);
    if (onPhaseCallback) await start(null, onPhaseCallback);
  } finally {
    cooldownNext = false;
  }
}

export async function prev() { return next(); }

export default {
  start, stop, next, prev,
};
