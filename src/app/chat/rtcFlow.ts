// src/app/chat/rtcFlow.ts
// Robust WebRTC flow: PN + attrs enqueue + strict gating + teardown/retry/backoff

"use client";

import apiSafeFetch from "@/app/chat/safeFetch";

// Attach x-last-stop-ts for ICE grace
function markLastStopTs() {
  try { localStorage.setItem("ditona:lastStopTs", String(Date.now())); } catch {}
}
function rtcHeaders(extra?: { pairId?: string | null; role?: string | null }) {
  const h: Record<string, string> = {};
  try {
    const ts = localStorage.getItem("ditona:lastStopTs");
    if (ts) h["x-last-stop-ts"] = ts;
  } catch {}
  if (extra?.pairId) h["x-pair-id"] = String(extra.pairId);
  return h;
}

export type Phase = "idle" | "searching" | "matched" | "connected" | "stopped";
type Role = "caller" | "callee";

type State = {
  sid: number;
  phase: Phase;
  pairId: string | null;
  role: Role | null;
  pc: RTCPeerConnection | null;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
  ac?: AbortController;
};
const state: State = { sid: 0, phase: "idle", pairId: null, role: null, pc: null, makingOffer: false, ignoreOffer: false, polite: false, ac: undefined };

let onPhase: (p: Phase) => void = () => {};
let cooldownNext = false;

const ICE_SERVERS: RTCConfiguration = { iceServers: [] }; // TURN/ICE supplied elsewhere

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function isAbort(e: any) { return !!(e?.name === "AbortError"); }
function swallowAbort(e: any) { if (!isAbort(e)) console.warn(e); }

function sdpTagOf(sdp: string, kind: "offer" | "answer") {
  try {
    let x = 0;
    for (let i = 0; i < Math.min(512, sdp.length); i++) x = (x * 33 + sdp.charCodeAt(i)) | 0;
    return `${kind}:${sdp.length}:${(x >>> 0).toString(36)}`;
  } catch { return `${kind}:${sdp.length}:0`; }
}

async function ensureEnqueue() {
  const body = { gender: "u", country: "XX", filterGenders: "all", filterCountries: "ALL" };
  await apiSafeFetch("/api/rtc/enqueue", {
    method: "POST",
    headers: { "content-type": "application/json", ...rtcHeaders() },
    body: JSON.stringify(body),
    timeoutMs: 5000,
  }).catch(swallowAbort);
}

async function pollMatchmake(ac: AbortController) {
  // Poll until 200 {pairId,role}; on 400 => enqueue then retry
  let back = 350;
  while (!ac.signal.aborted) {
    const r = await apiSafeFetch("/api/rtc/matchmake", { method: "GET", headers: rtcHeaders(), timeoutMs: 5000 }).catch(swallowAbort);
    if (r?.status === 200) {
      const j = await r.json().catch(() => ({}));
      if (j?.pairId && j?.role) return j as { pairId: string; role: Role; peerAnonId?: string };
    } else if (r?.status === 400) {
      await ensureEnqueue();
    }
    await sleep(back + Math.floor(Math.random() * 200));
    back = Math.min(back * 1.3, 1400);
  }
  throw new DOMException("aborted", "AbortError");
}

function guardNegotiationNeeded(currentSid: number) {
  if (!state.pc || state.ac?.signal.aborted || currentSid !== state.sid) return false;
  if (!state.pairId || !state.role) return false;
  return true;
}

function attachHandlers(pc: RTCPeerConnection, currentSid: number) {
  pc.onnegotiationneeded = async () => {
    if (!guardNegotiationNeeded(currentSid)) return;
    if (state.role !== "caller") return; // caller only
    try {
      state.makingOffer = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await apiSafeFetch("/api/rtc/offer", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ditona-sdp-tag": sdpTagOf(JSON.stringify(offer), "offer"), ...rtcHeaders({ pairId: state.pairId, role: state.role }) },
        body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(offer) }),
        timeoutMs: 8000,
      }).catch(swallowAbort);
    } catch (e) { console.warn("[rtc] onnegotiationneeded error", e); }
    finally { state.makingOffer = false; }
  };

  pc.onicecandidate = async (e) => {
    if (!e.candidate) return;
    if (!guardNegotiationNeeded(currentSid)) return;
    await apiSafeFetch("/api/rtc/ice", {
      method: "POST",
      headers: { "content-type": "application/json", ...rtcHeaders({ pairId: state.pairId, role: state.role }) },
      body: JSON.stringify({ pairId: state.pairId, role: state.role, candidate: e.candidate }),
      timeoutMs: 5000,
    }).catch(swallowAbort);
  };
}

async function icePump(currentSid: number) {
  let back = 300;
  while (currentSid === state.sid && !state.ac?.signal.aborted && state.pairId && state.role) {
    const r = await apiSafeFetch(`/api/rtc/ice?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 5000,
    }).catch(swallowAbort);
    if (r?.status === 200) {
      const arr = await r.json().catch(() => ([]));
      for (const c of Array.isArray(arr) ? arr : []) {
        try { await state.pc!.addIceCandidate(c); } catch (e) { console.warn("[rtc] addIceCandidate", e); }
      }
      back = 300;
    }
    await sleep(back + Math.floor(Math.random() * 250));
    back = Math.min(back * 1.3, 1200);
  }
}

async function callerFlow(currentSid: number) {
  let back = 400;
  while (currentSid === state.sid && state.pairId && state.role === "caller") {
    const r = await apiSafeFetch(`/api/rtc/answer?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 6000,
    }).catch(swallowAbort);
    if (r?.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        try { await state.pc!.setRemoteDescription(JSON.parse(String(sdp))); } catch (e) { console.warn("[rtc] caller setRemoteDescription", e); }
        return;
      }
    }
    await sleep(back);
    back = Math.min(back * 1.3, 1600);
  }
}

async function calleeFlow(currentSid: number) {
  let back = 400;
  while (currentSid === state.sid && state.pairId && state.role === "callee") {
    const r = await apiSafeFetch(`/api/rtc/offer?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 6000,
    }).catch(swallowAbort);
    if (r?.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        const offer = JSON.parse(String(sdp));
        const collision = offer?.type === "offer" && (state.makingOffer || state.pc!.signalingState !== "stable");
        state.ignoreOffer = state.role !== "callee" && collision; // impolite ignores
        try {
          if (!state.ignoreOffer) {
            if (collision) { try { await state.pc!.setLocalDescription({ type: "rollback" } as any); } catch {} }
            await state.pc!.setRemoteDescription(offer);
            const answer = await state.pc!.createAnswer();
            await state.pc!.setLocalDescription(answer);
            await apiSafeFetch("/api/rtc/answer", {
              method: "POST",
              headers: { "content-type": "application/json", "x-ditona-sdp-tag": sdpTagOf(JSON.stringify(answer), "answer"), ...rtcHeaders({ pairId: state.pairId, role: state.role }) },
              body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(answer) }),
              timeoutMs: 8000,
            }).catch(swallowAbort);
          }
        } catch (e) { console.warn("[rtc] calleeFlow", e); }
        return;
      }
    }
    await sleep(back);
    back = Math.min(back * 1.3, 1600);
  }
}

/* Public API */
export async function start(media: MediaStream | null, onPhaseCb: (p: Phase) => void) {
  stop(); // hard reset
  onPhase = onPhaseCb;
  state.sid = (state.sid + 1) | 0;
  state.phase = "searching"; onPhase("searching");
  state.ac = new AbortController();

  // Ensure attrs in Redis
  await ensureEnqueue();

  const mm = await pollMatchmake(state.ac);
  state.pairId = mm.pairId; state.role = mm.role as Role; state.polite = state.role === "callee";
  state.phase = "matched"; onPhase("matched");

  state.pc = new RTCPeerConnection(ICE_SERVERS);
  if (media) for (const t of media.getTracks()) state.pc.addTrack(t, media);
  attachHandlers(state.pc, state.sid);
  icePump(state.sid).catch(swallowAbort);

  if (state.role === "caller") await callerFlow(state.sid); else await calleeFlow(state.sid);

  state.pc.onconnectionstatechange = () => {
    if (!state.pc) return;
    if (state.pc.connectionState === "connected") { state.phase = "connected"; onPhase("connected"); }
    if (state.pc.connectionState === "closed") { stop(); }
  };
}

export function stop(mode: "full"|"network" = "full") {
  try { markLastStopTs(); } catch {}
  try { state.ac?.abort(); } catch {}
  state.ac = undefined;

  try { state.pc?.close(); } catch {} finally { state.pc = null; }

  if (mode === "full") {
    state.pairId = null; state.role = null; state.phase = "stopped";
    try { localStorage.removeItem("ditona_pair"); } catch {}
    try { onPhase("stopped"); } catch {}
  }
}

export async function next() {
  if (cooldownNext) return;
  cooldownNext = true;
  try {
    stop("network");
    await sleep(650);
    await start(null, onPhase);
  } finally { cooldownNext = false; }
}
export async function prev() { return next(); }
