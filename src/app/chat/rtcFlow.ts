// src/app/chat/rtcFlow.ts
// Robust WebRTC flow: PN + attrs enqueue + strict gating + teardown/retry/backoff
"use client";

import apiSafeFetch from "@/app/chat/safeFetch";

console.info("RTC_FLOW_VERSION=S1.3"); // ← إضافة للتحقق أن الباندل هو الأحدث


// ========= helpers =========
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
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
const MATCH_POLL_BASE_MS = 350;
const MATCH_POLL_JITTER_MS = 150;
const jitter = (base = MATCH_POLL_BASE_MS, j = MATCH_POLL_JITTER_MS) =>
  base + Math.floor(Math.random() * j);
function isAbort(e: any) { return e?.name === "AbortError"; }
function swallowAbort(e: any) { if (!isAbort(e)) console.warn(e); }

// ========= types/state =========
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
const state: State = {
  sid: 0,
  phase: "idle",
  pairId: null,
  role: null,
  pc: null,
  makingOffer: false,
  ignoreOffer: false,
  polite: false,
  ac: undefined,
};
let onPhase: (p: Phase) => void = () => {};
let cooldownNext = false;

const ICE_SERVERS: RTCConfiguration = { iceServers: [] }; // TURN/ICE elsewhere

// ========= SDP tag =========
function sdpTagOf(sdp: string, kind: "offer" | "answer") {
  try {
    let x = 0;
    for (let i = 0; i < Math.min(512, sdp.length); i++) x = (x * 33 + sdp.charCodeAt(i)) | 0;
    return `${kind}:${sdp.length}:${(x >>> 0).toString(36)}`;
  } catch { return `${kind}:${sdp.length}:0`; }
}

// ========= session attrs =========
function getSessionAttrs() {
  const get = (k: string, d: string) => {
    try { return localStorage.getItem(k) || d; } catch { return d; }
  };
  const gender = get("ditona:gender", "u");
  const country = get("ditona:country", "XX");
  const filterGenders = get("ditona:filterGenders", "all");
  const filterCountries = get("ditona:filterCountries", "ALL");
  return { gender, country, filterGenders, filterCountries };
}

// ========= enqueue with guarantee =========
async function ensureEnqueue(opts?: { retry?: boolean; max?: number }): Promise<boolean> {
  console.debug("[enqueue] start");                 // ← سطر جديد
  const max = opts?.max ?? (opts?.retry ? 4 : 1);
  for (let i = 0; i < max; i++) {
    const body = getSessionAttrs();
    const r = await apiSafeFetch("/api/rtc/enqueue", {
      method: "POST",
      headers: { "content-type": "application/json", ...rtcHeaders() },
      body: JSON.stringify(body),
      timeoutMs: 5000,
    }).catch(swallowAbort);

    const status = r?.status ?? 0;
    console.debug("[enqueue]", { try: i + 1, status });

    if (status === 200 || status === 204) return true;
    if (status === 400 || status === 429 || status === 0 || (status >= 500 && status < 600)) {
      await sleep(jitter(500, 300));
      continue;
    }
    await sleep(jitter(400, 200));
  }
  return false;
}

// ========= matchmake polling =========
async function pollMatchmake(ac: AbortController) {
  let back = MATCH_POLL_BASE_MS;
  while (!ac.signal.aborted) {
    const r = await apiSafeFetch("/api/rtc/matchmake", {
      method: "GET",
      headers: rtcHeaders(),
      timeoutMs: 5000,
    }).catch(swallowAbort);

    const status = r?.status ?? 0;

    if (status === 200) {
      const j = await r!.json().catch(() => ({}));
      if (j?.pairId && j?.role) return j as { pairId: string; role: Role; peerAnonId?: string };
    } else if (status === 204) {
      // no partner yet
    } else if (status === 400) {
      const b = (await r!.json().catch(() => ({}))) || {};
      if (b?.error === "attrs-missing") {
        await ensureEnqueue({ retry: true, max: 4 });
      }
    } else if (status === 429) {
      back = Math.min(back * 1.5, 1600);
    } else {
      back = Math.min(back * 1.3, 1600);
    }

    await sleep(jitter(back, MATCH_POLL_JITTER_MS + 50));
  }
  throw new DOMException("aborted", "AbortError");
}

// ========= negotiation guard =========
function guardNegotiationNeeded(currentSid: number) {
  if (!state.pc || state.ac?.signal.aborted || currentSid !== state.sid) return false;
  if (!state.pairId || !state.role) return false;
  return true;
}

// ========= RTC handlers =========
function attachHandlers(pc: RTCPeerConnection, currentSid: number) {
  pc.onnegotiationneeded = async () => {
    if (!guardNegotiationNeeded(currentSid)) return;
    if (state.role !== "caller") return;
    try {
      state.makingOffer = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await apiSafeFetch("/api/rtc/offer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ditona-sdp-tag": sdpTagOf(JSON.stringify(offer), "offer"),
          ...rtcHeaders({ pairId: state.pairId, role: state.role }),
        },
        body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(offer) }),
        timeoutMs: 8000,
      }).catch(swallowAbort);
    } catch (e) {
      console.warn("[rtc] onnegotiationneeded", e);
    } finally {
      state.makingOffer = false;
    }
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
    await sleep(jitter(back, 250));
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
        state.ignoreOffer = state.role !== "callee" && collision;
        try {
          if (!state.ignoreOffer) {
            if (collision) {
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
                ...rtcHeaders({ pairId: state.pairId, role: state.role }),
              },
              body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(answer) }),
              timeoutMs: 8000,
            }).catch(swallowAbort);
          }
        } catch (e) {
          console.warn("[rtc] calleeFlow", e);
        }
        return;
      }
    }
    await sleep(back);
    back = Math.min(back * 1.3, 1600);
  }
}

// ========= Public API =========
export async function start(media: MediaStream | null, onPhaseCb: (p: Phase) => void) {
  stop();
  onPhase = onPhaseCb;
  state.sid = (state.sid + 1) | 0;
  state.phase = "searching"; onPhase("searching");
  state.ac = new AbortController();

  const ok = await ensureEnqueue({ retry: true, max: 4 });
  console.debug("[enqueue] done =", ok);              // ← يؤكد النتيجة
await apiSafeFetch("/api/rtc/diag/attrs", { method: "GET", timeoutMs: 4000 })
  .then(r => r.json())
  .then(j => console.debug("[diag/attrs]", j))      // ← يجب أن ترى exists:true
  .catch(() => {});
  if (!ok) {
    console.warn("[start] enqueue failed — aborting search");
    stop("network");
    return;
  }
  const mm = await pollMatchmake(state.ac);
  state.pairId = mm.pairId;
  state.role = mm.role as Role;
  state.polite = state.role === "callee";
  state.phase = "matched"; onPhase("matched");

  state.pc = new RTCPeerConnection(ICE_SERVERS);
  if (media) for (const t of media.getTracks()) state.pc.addTrack(t, media);
  attachHandlers(state.pc, state.sid);
  icePump(state.sid).catch(swallowAbort);

  if (state.role === "caller") await callerFlow(state.sid);
  else await calleeFlow(state.sid);

  state.pc.onconnectionstatechange = () => {
    const s = state.pc?.connectionState;
    if (s === "connected") { state.phase = "connected"; onPhase("connected"); }
    if (s === "closed") { stop(); }
  };
}

export function stop(mode: "full" | "network" = "full") {
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
