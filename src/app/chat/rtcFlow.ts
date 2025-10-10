// src/app/chat/rtcFlow.ts
// Robust PN + attrs enqueue + idempotent signaling + strict AC guards

"use client";

import apiSafeFetch from "@/app/chat/safeFetch";

/* === headers helpers (محلية وخفيفة) === */
function rtcHeaders(extra?: { pairId?: string | null; role?: string | null }) {
  const h = new Headers();
  if (extra?.pairId) h.set("x-pair-id", String(extra.pairId));
  if (extra?.role) h.set("x-role", String(extra.role));
  return Object.fromEntries(h.entries());
}
function markLastStopTs() {
  try { (window as any).__ditona_last_stop_ts = Date.now(); } catch {}
}

/* === types/state === */
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

let inflightStart: Promise<{ pairId: string | null; role: Role | null } | null> | null = null;
let onPhaseCallback: (p: Phase) => void = () => {};
let cooldownNext = false;

const ICE_SERVERS: RTCConfiguration = { iceServers: [] };

/* === utils === */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isAbort = (e: any) => !!(e?.name === "AbortError");
function swallowAbort(e: any) { if (!isAbort(e)) console.warn(e); }
function logRtc(event: string, status = 200, extra: any = {}) {
  try { console.log(JSON.stringify({ ts: new Date().toISOString(), route: "/chat/rtcFlow", event, status, ...extra })); } catch {}
}
function checkSession(sid: number) { return sid === state.sid; }

/* === bootstrap === */
async function initAnon() {
  await apiSafeFetch("/api/rtc/init", { method: "GET", timeoutMs: 6000 }).catch(swallowAbort);
}
async function ensureEnqueue() {
  await apiSafeFetch("/api/rtc/enqueue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gender: "u",
      country: "XX",
      filterGenders: "all",
      filterCountries: "ALL",
    }),
    timeoutMs: 6000,
  }).catch(swallowAbort);
}

/* === signaling helpers === */
function sdpTagOf(sdp: string, kind: "offer" | "answer") {
  try {
    let x = 0;
    for (let i = 0; i < Math.min(512, sdp.length); i++) x = (x * 33 + sdp.charCodeAt(i)) | 0;
    return `${kind}:${sdp.length}:${(x >>> 0).toString(36)}`;
  } catch { return `${kind}:${sdp.length}:0`; }
}

/** بولنغ matchmake مع حارس AC صارم */
async function pollMatchmake() {
  const ac = state.ac;
  if (!ac || !ac.signal) throw new DOMException("aborted", "AbortError");

  let back = 400;
  for (;;) {
    if (ac.signal.aborted) throw new DOMException("aborted", "AbortError");

    const r = await apiSafeFetch("/api/rtc/matchmake", {
      method: "GET",
      headers: rtcHeaders(),
      timeoutMs: 4500,
    }).catch(() => undefined);

    if (!r) { await sleep(back); back = Math.min(back * 1.5, 1500); continue; }

    if (r.status === 200) {
      const j = await r.json().catch(() => ({} as any));
      if (j?.pairId && j?.role) return j as { pairId: string; role: Role; peerAnonId?: string };
    } else if (r.status === 204) {
      // لا شيء
    } else if (r.status === 400) {
      // attrs مفقودة فعليًا → أعد enqueue
      await ensureEnqueue();
    }

    await sleep(back + Math.floor(Math.random() * 150));
    back = Math.min(back * 1.3, 1200);
  }
}

function attachPnHandlers(pc: RTCPeerConnection, currentSession: number) {
  pc.onnegotiationneeded = async () => {
    // caller فقط هو من يبدأ offer
    if (!checkSession(currentSession) || !state.ac || state.ac.signal.aborted || !state.pc || state.role !== "caller") return;
    try {
      state.makingOffer = true;
      const offer = await state.pc.createOffer();
      await state.pc.setLocalDescription(offer);
      const s = JSON.stringify(offer);
      await apiSafeFetch("/api/rtc/offer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ditona-sdp-tag": sdpTagOf(s, "offer"),
          ...rtcHeaders({ pairId: state.pairId, role: state.role }),
        },
        body: JSON.stringify({ pairId: state.pairId, sdp: s }),
        timeoutMs: 8000,
      }).catch(swallowAbort);
    } finally {
      state.makingOffer = false;
    }
  };

  pc.onicecandidate = async (e) => {
    if (!e.candidate || !checkSession(currentSession) || !state.ac || state.ac.signal.aborted) return;
    if (!state.pairId || !state.role) return;
    await apiSafeFetch("/api/rtc/ice", {
      method: "POST",
      headers: { "content-type": "application/json", ...rtcHeaders({ pairId: state.pairId, role: state.role }) },
      body: JSON.stringify({ pairId: state.pairId, role: state.role, candidate: e.candidate }),
    }).catch(swallowAbort);
  };
}

/** مضخة ICE — تتوقف فور غياب/إلغاء الـAC */
async function iceExchange(sessionId: number) {
  let backoff = 300;
  while (checkSession(sessionId) && state.ac && !state.ac.signal.aborted && state.pairId && state.role) {
    const r = await apiSafeFetch(`/api/rtc/ice?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 5000,
    }).catch(swallowAbort);

    if (r?.status === 200) {
      const items = await r.json().catch(() => ([]));
      for (const cand of Array.isArray(items) ? items : []) {
        try { await state.pc!.addIceCandidate(cand); } catch (e) { logRtc("addIceCandidate", 500, { e: String(e) }); }
      }
      backoff = 300;
    }
    await sleep(backoff + Math.floor(Math.random() * 250));
    backoff = Math.min(backoff * 1.3, 1200);
  }
}

/** caller ينتظر answer */
async function callerFlow(sessionId: number) {
  let back = 400;
  while (checkSession(sessionId) && state.ac && !state.ac.signal.aborted && state.pairId && state.role === "caller") {
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
        } catch (e) { logRtc("callerFlow-remote-desc", 500, { e: String(e) }); }
      }
    }
    await sleep(back);
    back = Math.min(back * 1.3, 1500);
  }
}

/** callee يسحب offer ويرد وفق PN */
async function calleeFlow(sessionId: number) {
  let back = 400;
  while (checkSession(sessionId) && state.ac && !state.ac.signal.aborted && state.pairId && state.role === "callee") {
    const r = await apiSafeFetch(`/api/rtc/offer?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 6000,
    }).catch(swallowAbort);

    if (r?.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        try {
          const offer = JSON.parse(String(sdp));
          const offerCollision = offer?.type === "offer" && (state.makingOffer || state.pc!.signalingState !== "stable");
          state.ignoreOffer = !state.polite && offerCollision;
          if (!state.ignoreOffer) {
            if (offerCollision) {
              try { await state.pc!.setLocalDescription({ type: "rollback" } as any); } catch {}
            }
            await state.pc!.setRemoteDescription(offer);
            const answer = await state.pc!.createAnswer();
            await state.pc!.setLocalDescription(answer);
            const s = JSON.stringify(answer);
            await apiSafeFetch("/api/rtc/answer", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-ditona-sdp-tag": sdpTagOf(s, "answer"),
                ...rtcHeaders({ pairId: state.pairId, role: state.role }),
              },
              body: JSON.stringify({ pairId: state.pairId, sdp: s }),
              timeoutMs: 8000,
            }).catch(swallowAbort);
          }
          return;
        } catch (e) { logRtc("calleeFlow-error", 500, { e: String(e) }); }
      }
    }
    await sleep(back);
    back = Math.min(back * 1.3, 1500);
  }
}

/* ========================= public API ========================= */

/**
 * start(media, onPhase?)
 * يمنع الإقلاع المتوازي. ينشئ AbortController داخليًا دائمًا.
 */
export async function start(media?: MediaStream | null, onPhase?: (phase: Phase) => void) {
  if (inflightStart) return inflightStart;

  inflightStart = (async () => {
    try {
      // أوقف الشبكة القديمة فقط
      stop("network");

      if (typeof onPhase === "function") onPhaseCallback = onPhase;

      state.sid = (state.sid + 1) | 0;
      state.phase = "searching";
      try { onPhaseCallback("searching"); } catch {}

      // AC داخلي
      state.ac = new AbortController();

      await initAnon();
      await ensureEnqueue();

      const mm = await pollMatchmake();
      if (!mm?.pairId || !mm?.role) throw new Error("no-pair");

      state.pairId = mm.pairId;
      state.role = mm.role as Role;
      state.polite = state.role === "callee";
      try { onPhaseCallback("matched"); } catch {}
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId: state.pairId, role: state.role } }));
      }

      // PC + ميديا
      state.pc = new RTCPeerConnection(ICE_SERVERS);
      attachPnHandlers(state.pc, state.sid);
      if (media) for (const t of media.getTracks()) state.pc.addTrack(t, media);

      state.pc.ontrack = (ev) => {
        const [s] = ev.streams || [];
        if (s && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("rtc:remote-track", { detail: { stream: s } }));
        }
      };

      // ICE pump
      iceExchange(state.sid).catch(swallowAbort);

      // Perfect Negotiation
      if (state.role === "caller") await callerFlow(state.sid);
      else await calleeFlow(state.sid);

      state.pc.onconnectionstatechange = () => {
        if (!checkSession(state.sid) || !state.pc) return;
        const cs = state.pc.connectionState;
        logRtc("connection-state", 200, { connectionState: cs });
        if (cs === "connected") {
          state.phase = "connected";
          try { onPhaseCallback("connected"); } catch {}
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ditona:phase", { detail: { phase: "connected", role: state.role } }));
        } else if (cs === "closed") {
          stop();
        }
      };

      if (typeof window !== "undefined") (window as any).ditonaPC = state.pc;

      return { pairId: state.pairId, role: state.role };
    } catch (e) {
      if (!isAbort(e)) console.warn("rtcFlow.start error", e);
      stop();
      return null;
    } finally {
      inflightStart = null;
    }
  })();

  return inflightStart;
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
    state.phase = "stopped";
    try { onPhaseCallback("stopped"); } catch {}
  }
}

export async function next() {
  if (cooldownNext) return;
  cooldownNext = true;
  try {
    stop("network");
    await sleep(700);
    await start(null, onPhaseCallback);
  } finally {
    cooldownNext = false;
  }
}

export async function prev() { return next(); }
export const startRTCFlow = start;
