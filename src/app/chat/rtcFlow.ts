// src/app/chat/rtcFlow.ts
// Robust WebRTC flow for DitonaChat:
// - Strict AbortController guards
// - Stable bootstrap: /api/rtc/init → /api/rtc/enqueue → poll /api/rtc/matchmake
// - Perfect Negotiation with rollback on glare
// - Idempotent signaling via x-ditona-sdp-tag (from raw SDP string)
// - ICE pump with graceful stop (+ x-last-stop-ts)
// - Clean teardown + unified backoff
// - No new deps/ENV

"use client";

import apiSafeFetch from "@/app/chat/safeFetch";

/* ========================= diagnostics ========================= */

const RTC_FLOW_VERSION = "S2.3-PN-AC-Strict";

/** bounded in-memory ring buffer under window.__rtcLog */
function pushDiag(...args: any[]) {
  try {
    console.log("[rtc]", ...args);
    const w: any = typeof window !== "undefined" ? window : undefined;
    if (!w) return;
    const buf: any[] = w.__rtcLog || [];
    buf.push(args);
    if (buf.length > 250) buf.splice(0, buf.length - 250);
    w.__rtcLog = buf;
  } catch {}
}

/* ========================= headers helpers ========================= */

function getLastStopTs(): number | null {
  try {
    const w: any = window;
    const mem = Number(w.__ditona_last_stop_ts || 0) || 0;
    const ls = Number(window.localStorage?.getItem("ditona:lastStopTs") || 0) || 0;
    const ts = Math.max(mem, ls);
    return ts > 0 ? ts : null;
  } catch {
    return null;
  }
}

function markLastStopTs() {
  const ts = Date.now();
  try {
    (window as any).__ditona_last_stop_ts = ts;
  } catch {}
  try {
    window.localStorage?.setItem("ditona:lastStopTs", String(ts));
  } catch {}
}

/** Compose standard RTC headers for API requests. */
function rtcHeaders(extra?: { pairId?: string | null; role?: string | null }) {
  const h = new Headers();
  const ts = getLastStopTs();
  if (ts) h.set("x-last-stop-ts", String(ts));
  if (extra?.pairId) h.set("x-pair-id", String(extra.pairId));
  if (extra?.role) h.set("x-role", String(extra.role));
  return Object.fromEntries(h.entries());
}

/* ========================= state & types ========================= */

export type Phase = "idle" | "searching" | "matched" | "connected" | "stopped";
type Role = "caller" | "callee";

type State = {
  sid: number;
  phase: Phase;
  pairId: string | null;
  role: Role | null;

  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;

  // PN flags
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;

  // Abort for this session
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

let inflightStart: Promise<{ pairId: string; role: Role } | null> | null = null;
let onPhaseCallback: (p: Phase) => void = () => {};
let cooldownNext = false;

/* ========================= utils ========================= */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isAbort = (e: any) => !!(e?.name === "AbortError");

function swallowAbort(e: any) {
  if (!isAbort(e)) console.warn(e);
}

function checkSession(sid: number) {
  return sid === state.sid;
}

/** Tiny, deterministic tag from the first ~512 chars (non-crypto, stable). */
function sdpTagOf(sdp: string, kind: "offer" | "answer") {
  try {
    let x = 0;
    const L = Math.min(512, sdp.length);
    for (let i = 0; i < L; i++) x = (x * 33 + sdp.charCodeAt(i)) | 0;
    return `${kind}:${sdp.length}:${(x >>> 0).toString(36)}`;
  } catch {
    return `${kind}:${sdp.length}:0`;
  }
}

/* ========================= bootstrap calls ========================= */

/** Ensure anon cookie exists. Prefer GET /api/rtc/init to match current server. */
async function ensureInit() {
  await apiSafeFetch("/api/rtc/init", {
  method: "POST",
  credentials: "include",
  cache: "no-store",
  timeoutMs: 6000,
}).catch(swallowAbort);
}

/** Write attrs/filters + queue (normalized values). */
async function ensureEnqueue() {
  await apiSafeFetch("/api/rtc/enqueue", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json", ...rtcHeaders() },
    body: JSON.stringify({
      gender: "u",
      country: "XX",
      filterGenders: "all",
      filterCountries: "ALL",
    }),
    timeoutMs: 6000,
  }).catch(swallowAbort);
}

/** poll /matchmake with strict AC guard; auto re-init/enqueue on 400/403. */
async function pollMatchmake(): Promise<{ pairId: string; role: Role; peerAnonId?: string }> {
  const acNow = state.ac;
  if (!acNow || !acNow.signal) throw new DOMException("aborted", "AbortError");

  let back = 420;
  for (;;) {
    if (acNow.signal.aborted) throw new DOMException("aborted", "AbortError");

    const r = await apiSafeFetch("/api/rtc/matchmake", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: rtcHeaders(),
      timeoutMs: 4500,
    }).catch(() => undefined);

    if (!r) {
      await sleep(back);
      back = Math.min(back * 1.5, 1500);
      continue;
    }

    if (r.status === 200) {
      const j = await r.json().catch(() => ({} as any));
      if (j?.pairId && j?.role) return j as { pairId: string; role: Role; peerAnonId?: string };
    } else if (r.status === 204) {
      // keep polling
    } else if (r.status === 400) {
      // transient missing-attrs
      await ensureEnqueue();
    } else if (r.status === 403) {
      // anon drift or missing cookie
      await ensureInit();
      await ensureEnqueue();
    } else if (r.status >= 500) {
      await sleep(300);
    }

    await sleep(back + Math.floor(Math.random() * 150));
    back = Math.min(back * 1.25, 1200);
  }
}

/* ========================= Perfect Negotiation helpers ========================= */

function wirePerfectNegotiation(pc: RTCPeerConnection, currentSession: number) {
  pc.onnegotiationneeded = async () => {
    // Only caller drives offers
    if (!checkSession(currentSession)) return;
    if (!state.pc || state.ac?.signal.aborted) return;
    if (state.role !== "caller") return;

    try {
      state.makingOffer = true;
      const offer = await state.pc.createOffer();
      await state.pc.setLocalDescription(offer);

      const sdpStr = state.pc.localDescription?.sdp || offer.sdp || "";
      pushDiag("pn:offer:create");
      await apiSafeFetch("/api/rtc/offer", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-ditona-sdp-tag": sdpTagOf(sdpStr, "offer"),
          ...rtcHeaders({ pairId: state.pairId, role: state.role }),
        },
        body: JSON.stringify({ pairId: state.pairId, sdp: sdpStr }),
        timeoutMs: 9000,
      }).catch(swallowAbort);
      pushDiag("pn:offer:sent");
    } catch (e) {
      pushDiag("pn:offer:error", String((e as any)?.message || e));
    } finally {
      state.makingOffer = false;
    }
  };

  pc.onicecandidate = async (e) => {
    if (!checkSession(currentSession)) return;
    if (!e.candidate || !state.pairId || !state.role) return;
    if (state.ac?.signal.aborted) return;

    try {
      const anyCand: any = e.candidate;
      pushDiag("pc:ice:cand", { type: anyCand?.type, proto: anyCand?.protocol });
    } catch {}

    await apiSafeFetch("/api/rtc/ice", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json", ...rtcHeaders({ pairId: state.pairId, role: state.role }) },
      body: JSON.stringify({ pairId: state.pairId, role: state.role, candidate: e.candidate }),
    }).catch(swallowAbort);
  };
}

/* ========================= ICE pump ========================= */

async function iceExchange(sessionId: number) {
  let backoff = 320;
  while (
    checkSession(sessionId) &&
    state.ac &&
    !state.ac.signal.aborted &&
    state.pairId &&
    state.role &&
    state.pc
  ) {
    const r = await apiSafeFetch(`/api/rtc/ice?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 6000,
    }).catch(swallowAbort);

    if (r?.status === 200) {
      const items = await r.json().catch(() => []);
      const arr = Array.isArray(items) ? items : [];
      for (const cand of arr) {
        try {
          await state.pc!.addIceCandidate(cand);
        } catch (e) {
          pushDiag("pc:addIceCandidate:error", String(e));
        }
      }
      backoff = 320;
    }
    await sleep(backoff + Math.floor(Math.random() * 240));
    backoff = Math.min(backoff * 1.25, 1200);
  }
}

/* ========================= role flows ========================= */

async function callerFlow(sessionId: number) {
  // Wait for answer
  let back = 420;
  while (
    checkSession(sessionId) &&
    state.ac &&
    !state.ac.signal.aborted &&
    state.pairId &&
    state.role === "caller" &&
    state.pc
  ) {
    const r = await apiSafeFetch(`/api/rtc/answer?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 7000,
    }).catch(swallowAbort);

    if (r?.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        try {
          await state.pc!.setRemoteDescription({ type: "answer", sdp: String(sdp) });
          pushDiag("pn:answer:set");
          return;
        } catch (e) {
          pushDiag("caller:setRemote:error", String(e));
        }
      }
    }
    await sleep(back);
    back = Math.min(back * 1.25, 1500);
  }
}

async function calleeFlow(sessionId: number) {
  // Pull offer and reply using PN rules
  let back = 420;
  while (
    checkSession(sessionId) &&
    state.ac &&
    !state.ac.signal.aborted &&
    state.pairId &&
    state.role === "callee" &&
    state.pc
  ) {
    const r = await apiSafeFetch(`/api/rtc/offer?pairId=${encodeURIComponent(state.pairId)}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: rtcHeaders({ pairId: state.pairId, role: state.role }),
      timeoutMs: 7000,
    }).catch(swallowAbort);

    if (r?.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        try {
           const offerSdp = String(sdp);
         // receiving a remote OFFER; glare if we're making an offer or not stable
          const offerCollision = state.makingOffer || state.pc!.signalingState !== "stable";
           state.ignoreOffer = !state.polite && offerCollision;


          if (!state.ignoreOffer) {
            if (offerCollision) {
              try {
                await state.pc!.setLocalDescription({ type: "rollback" } as any);
                pushDiag("pn:rollback");
              } catch {}
            }
            await state.pc!.setRemoteDescription({ type: "offer", sdp: offerSdp });
            const answer = await state.pc!.createAnswer();
            await state.pc!.setLocalDescription(answer);
            const sdpStr = state.pc!.localDescription?.sdp || answer.sdp || "";

            await apiSafeFetch("/api/rtc/answer", {
              method: "POST",
              credentials: "include",
              cache: "no-store",
              headers: {
                "content-type": "application/json",
                "x-ditona-sdp-tag": sdpTagOf(sdpStr, "answer"),
                ...rtcHeaders({ pairId: state.pairId, role: state.role }),
              },
              body: JSON.stringify({ pairId: state.pairId, sdp: sdpStr }),
              timeoutMs: 9000,
            }).catch(swallowAbort);

            pushDiag("pn:answer:sent");
          }
          return; // done
        } catch (e) {
          pushDiag("callee:error", String(e));
        }
      }
    }

    await sleep(back);
    back = Math.min(back * 1.25, 1500);
  }
}

/* ========================= public API ========================= */

/**
 * start(media?, onPhase?)
 * - Creates a new AC every time.
 * - Enforces init → enqueue → matchmake
 * - Guards loops by session id + AC
 */
export async function start(media?: MediaStream | null, onPhase?: (phase: Phase) => void) {
  if (inflightStart) return inflightStart;

  inflightStart = (async () => {
    try {
      stop("network");
      if (typeof onPhase === "function") onPhaseCallback = onPhase;

      state.sid = (state.sid + 1) | 0;
      state.phase = "searching";
      try {
        onPhaseCallback("searching");
      } catch {}
      pushDiag("RTC_FLOW_VERSION=" + RTC_FLOW_VERSION);

      // Allocate AC before any async
      state.ac = new AbortController();

      // Age + init
      await apiSafeFetch("/api/age/allow", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        timeoutMs: 6000,
      }).catch(swallowAbort);

      await ensureInit();

      // Enqueue → Match
      await ensureEnqueue();

      pushDiag("mm:polling");
      const mm = await pollMatchmake();
      pushDiag("mm:ok", mm);

      if (!mm?.pairId || !mm?.role) throw new Error("no-pair");
      state.pairId = mm.pairId;
      state.role = mm.role as Role;
      state.polite = state.role === "callee";
      try {
        onPhaseCallback("matched");
      } catch {}

      // Expose to UI/diagnostics
      try {
        (window as any).__pair = { pairId: state.pairId, role: state.role };
        window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId: state.pairId, role: state.role } }));
      } catch {}

      // Create PC
      const pcCfg: RTCConfiguration = {
        iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }],
        iceCandidatePoolSize: 4,
        bundlePolicy: "balanced",
        rtcpMuxPolicy: "require",
      };
      state.pc = new RTCPeerConnection(pcCfg);
      wirePerfectNegotiation(state.pc, state.sid);

      // connection diagnostics
      state.pc.onconnectionstatechange = () => {
        if (!checkSession(state.sid) || !state.pc) return;
        const cs = state.pc.connectionState;
        pushDiag("pc:connectionState", cs);
        if (cs === "connected") {
          state.phase = "connected";
          try {
            onPhaseCallback("connected");
          } catch {}
          try {
            window.dispatchEvent(new CustomEvent("ditona:phase", { detail: { phase: "connected", role: state.role } }));
          } catch {}
        } else if (cs === "closed") {
          stop();
        }
      };
      state.pc.oniceconnectionstatechange = () => {
        try {
          pushDiag("pc:iceConnectionState", state.pc?.iceConnectionState);
        } catch {}
      };

      // Media wiring
      try {
        if (media && media.getTracks) {
          for (const t of media.getTracks()) {
            try {
              state.pc.addTrack(t, media);
            } catch {}
          }
        } else {
          try {
            state.pc.addTransceiver("audio", { direction: "recvonly" });
          } catch {}
          try {
            state.pc.addTransceiver("video", { direction: "recvonly" });
          } catch {}
        }
      } catch (e) {
        pushDiag("media:wiring:error", String((e as any)?.name || e));
      }

      // Remote stream to UI
      state.pc.ontrack = (ev) => {
        try {
          const stream = (ev.streams && ev.streams[0]) ? ev.streams[0] : new MediaStream([ev.track]);
          pushDiag("pc:ontrack", { tracks: stream.getTracks().length });
          window.dispatchEvent(new CustomEvent("rtc:remote-track", { detail: { stream } }));
        } catch {}
      };

      // ICE pump
      iceExchange(state.sid).catch(swallowAbort);

      // Role-specific signaling
      if (state.role === "caller") await callerFlow(state.sid);
      else await calleeFlow(state.sid);

      try {
        (window as any).ditonaPC = state.pc;
      } catch {}

      return { pairId: state.pairId!, role: state.role! };
    } catch (e: any) {
      if (!isAbort(e)) console.warn("rtcFlow.start error", e);
      stop();
      return null;
    } finally {
      inflightStart = null;
    }
  })();

  return inflightStart;
}

/**
 * stop(mode)
 * - "network": abort loops and close pc/dc but keep logical pair/role until next()
 * - "full": also clear pair/role and emit "stopped"
 */
export function stop(mode: "full" | "network" = "full") {
  try {
    markLastStopTs();
  } catch {}

  try {
    state.ac?.abort();
  } catch {}
  state.ac = undefined;

  try {
    state.dc?.close();
  } catch {}
  state.dc = null;

  try {
    state.pc?.close();
  } catch {}
  state.pc = null;

  if (mode === "full") {
    state.pairId = null;
    state.role = null;
    state.phase = "stopped";
    try {
      onPhaseCallback("stopped");
    } catch {}
  }
}

/** Throttled next: tear down network then restart search after a short cool-down. */
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

/** Prev is symmetric to Next in current product flow. */
export async function prev() {
  return next();
}

/** Backward compatibility alias */
export const startRTCFlow = start;

// ————————————————————————
pushDiag("RTC_FLOW_VERSION", RTC_FLOW_VERSION);
