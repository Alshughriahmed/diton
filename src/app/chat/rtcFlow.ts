// rtcFlow.ts — Perfect Negotiation + Teardown + Backoff + Resets
// ملاحظات: لا قيم صلبة. العميل يقرأ فقط NEXT_PUBLIC_*.
// حدود حجم: نحمي إرسال SDP على ~200KB قبل POST.

import apiSafeFetch from "@/app/chat/safeFetch";
import { getLocalStream } from "@/lib/media";
import { sendRtcMetrics } from "@/utils/metrics";
import { rtcHeaders, markLastStopTs } from "@/app/chat/rtcHeaders.client";

/* region: helpers */
const isAbort = (e: any) => e && (e.name === "AbortError" || e.code === 20);
const swallowAbort = (e: any) => { if (!isAbort(e)) throw e; };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function safeAbort(ac?: AbortController | null) { try { if (ac && !ac.signal?.aborted) ac.abort("stop"); } catch {} }
function jsonSizeUtf8(obj: unknown): number { try { return new Blob([JSON.stringify(obj)]).size; } catch { return 0; } }
/* endregion */

/* region: TURN helpers (unchanged, with ordering) */
function hasTurns443FromPc(pc: RTCPeerConnection | null | undefined): boolean {
  try {
    const cfg = pc?.getConfiguration?.();
    const arr = Array.isArray(cfg?.iceServers) ? cfg!.iceServers : [];
    for (const s of arr) {
      const urls = Array.isArray((s as any).urls) ? (s as any).urls : [(s as any).urls];
      if (urls?.some((u: string) => /^turns?:.*:443(\?|$)/i.test(String(u)))) return true;
    }
  } catch {}
  return false;
}
function hasTurns443First(pc: RTCPeerConnection | null | undefined): boolean {
  try {
    const cfg = pc?.getConfiguration?.();
    const arr = Array.isArray(cfg?.iceServers) ? cfg!.iceServers : [];
    if (arr.length === 0) return false;
    const urls = Array.isArray((arr[0] as any).urls) ? (arr[0] as any).urls : [(arr[0] as any).urls];
    return urls?.some((u: string) => /^turns?:.*:443(\?|$)/i.test(String(u))) || false;
  } catch {}
  return false;
}
function reorderIceServers(servers: any[]): any[] {
  if (!Array.isArray(servers) || servers.length === 0) return servers;
  const turns443: any[] = [], turn443: any[] = [], turn3478: any[] = [], stun: any[] = [], other: any[] = [];
  for (const s of servers) {
    const urls = Array.isArray((s as any).urls) ? (s as any).urls : [(s as any).urls];
    if (urls?.some((u: string) => /^turns?:.*:443(\?|$)/i.test(String(u)))) { turns443.push(s); continue; }
    if (urls?.some((u: string) => /^turn:.*:443(\?|$)/i.test(String(u))))   { turn443.push(s);  continue; }
    if (urls?.some((u: string) => /^turn:.*:3478(\?|$)/i.test(String(u))))  { turn3478.push(s); continue; }
    if (urls?.some((u: string) => /^stuns?:/i.test(String(u))))             { stun.push(s);     continue; }
    other.push(s);
  }
  return [...turns443, ...turn443, ...turn3478, ...stun, ...other];
}
/* endregion */

/* region: state */
type Phase = "idle" | "searching" | "matched" | "connected" | "stopped";
interface RtcState {
  dc?: RTCDataChannel | null;
  remoteStream: MediaStream | null;
  sid: number;
  phase: Phase;
  role: "caller" | "callee" | null;
  pairId: string | null;
  ac: AbortController | null;
  pc: RTCPeerConnection | null;
  lastPeer: string | null;
  prevForOnce: string | null;
  // Perfect Negotiation flags
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  polite: boolean;
}
let state: RtcState = {
  remoteStream: null,
  sid: 0,
  phase: "idle",
  role: null,
  pairId: null,
  ac: null,
  pc: null,
  lastPeer: null,
  prevForOnce: null,
  makingOffer: false,
  ignoreOffer: false,
  isSettingRemoteAnswerPending: false,
  polite: false,
};
let onPhaseCallback: ((phase: Phase) => void) | null = null;
let session = 0;
let cooldownNext = false;

// KPIs
const __kpi = {
  tEnq: 0, tMatched: 0, tFirstRemote: 0, reconnectStart: 0, reconnectDone: 0, iceTries: 0,
  sessionId: (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : String(Date.now()),
};

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  try {
    window.addEventListener("unhandledrejection", (e: any) => { if ((e?.reason?.name || "") === "AbortError") e.preventDefault?.(); });
  } catch {}
}
/* endregion */

/* region: logging */
function logRtc(op: string, code: number, extra?: any) {
  console.log("[rtc]", { sid: state.sid, phase: state.phase, role: state.role, op, code, pair: state.pairId, ...extra });
}
function checkSession(sessionId: number) { return sessionId === session; }
function clearLocalStorage() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("ditona_role");
    window.localStorage.removeItem("ditona_pair");
    window.localStorage.removeItem("ditona_ice_sent");
  }
}
function ensureCallerOnly(operation: string) {
  if (state.role !== "caller") { logRtc(operation, 403, { reason: "role-guard-caller" }); throw new Error(`${operation} forbidden for ${state.role}`); }
}
function ensureCalleeOnly(operation: string) {
  if (state.role !== "callee") { logRtc(operation, 403, { reason: "role-guard-callee" }); throw new Error(`${operation} forbidden for ${state.role}`); }
}
/* endregion */

/* region: metrics */
async function collectAndSendMetrics() {
  if (!state.pc || !state.pairId) return;
  try {
    const stats = await state.pc.getStats();
    let candidateType = ""; let rtt = 0; let turn443Used = false;
    stats.forEach((s) => {
      if (s.type === "candidate-pair" && (s as any).state === "succeeded") candidateType = (s as any).remoteCandidateId || "";
      if (s.type === "remote-candidate") { if ((s as any).port === 443 || (s as any).relayProtocol) turn443Used = true; if ((s as any).candidateType) candidateType = (s as any).candidateType; }
      if (s.type === "transport" && typeof (s as any).currentRoundTripTime === "number") rtt = (s as any).currentRoundTripTime * 1000;
    });
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const ttfm = __kpi.tFirstRemote ? (now - __kpi.tFirstRemote) : 0;
    const duration = __kpi.tMatched ? (now - __kpi.tMatched) : 0;
    const payload = {
      ts: Date.now(),
      sessionId: __kpi.sessionId,
      pairId: state.pairId,
      role: state.role,
      matchMs: duration,
      ttfmMs: ttfm,
      reconnectMs: 0,
      iceOk: candidateType !== "",
      iceTries: 1,
      turns443: turn443Used,
      prevUsed: !!state.lastPeer
    };
    await apiSafeFetch("/api/monitoring/metrics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
  } catch (e) { console.warn("[rtc] metrics failed:", e); }
}
/* endregion */

/* region: stop */
export function stop(mode: "full" | "network" = "full") {
  try { markLastStopTs(); } catch {}
  try { __ditonaSetPair(undefined, (state as any).role); } catch {}
  try {
    const dc = (globalThis as any).__ditonaDataChannel;
    if (dc) { try { dc.onopen = dc.onmessage = dc.onclose = dc.onerror = null as any; } catch {} (globalThis as any).__ditonaDataChannel = null; }
    if (state.dc) { try { state.dc.onopen = state.dc.onmessage = state.dc.onclose = state.dc.onerror = null as any; } catch {} state.dc = null; }
  } catch {}
  try {
    try { safeAbort(state.ac); } catch {} state.ac = null;
    if (mode !== "full") {
      try { state.pc?.close(); } catch {} state.pc = null;
      try { state.remoteStream?.getTracks().forEach(t => t.stop()); } catch {} state.remoteStream = null;
      logRtc("stop", 206); return;
    }
    try { if (state.pairId && state.pc) collectAndSendMetrics(); } catch {}
    try { state.pc?.getSenders?.().forEach(s => { try { s.replaceTrack(null); } catch {} }); } catch {}
    try { state.pc?.close(); } catch {} state.pc = null;
    try { state.remoteStream?.getTracks().forEach(t => t.stop()); } catch {} state.remoteStream = null;

    // hint prev-for once
    try {
      const peer = (state && (state as any).lastPeer) || null;
      if (peer) {
        const H = rtcHeaders({ pairId: (state as any).pairId || undefined, role: (state as any).role || undefined });
        apiSafeFetch("/api/rtc/prev/for", {
          method: "POST",
          headers: { "content-type": "application/json", ...H },
          body: JSON.stringify({ peer })
        }).catch(() => {});
      }
    } catch {}

    // Reset واجهة المستخدم لكل pairId جديد
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ditona:chat:reset"));
        window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked: false } }));
      }
    } catch {}

    state.phase = "stopped";
    try { onPhaseCallback?.("stopped"); } catch {}
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "idle", role: null } }));
    clearLocalStorage();
   state.sid = 0; state.phase = "idle"; state.role = null; state.pairId = null;
try { __ditonaSetPair(((state as any).pairId || undefined), (state as any).role); } catch {}
logRtc("stop", 200); 
  } catch (e) { console.warn("[rtc] stop error:", e); }
}
/* endregion */

/* region: ICE servers */
async function getIceServers() {
  try {
    const r = await apiSafeFetch("/api/turn", { cache: "no-store" });
    if (r?.ok) { const j = await r.json(); return reorderIceServers(j.iceServers || [{ urls: "stun:stun.l.google.com:19302" }]); }
  } catch {}
  return [{ urls: "stun:stun.l.google.com:19302" }];
}
/* endregion */

/* region: Perfect Negotiation core */
async function applyRemoteDescriptionPN(desc: RTCSessionDescriptionInit, polite: boolean) {
  if (!state.pc) return;
  const pc = state.pc;

  const readyForOffer =
    !state.makingOffer &&
    (pc.signalingState === "stable" || state.isSettingRemoteAnswerPending);

  const offerCollision = desc.type === "offer" && !readyForOffer;

  state.ignoreOffer = !polite && offerCollision;
  if (state.ignoreOffer) {
    logRtc("pn-ignore-offer", 409, { polite, signaling: pc.signalingState });
    return;
  }
  if (offerCollision && polite) {
    try { await pc.setLocalDescription({ type: "rollback" } as any); } catch {}
  }

  state.isSettingRemoteAnswerPending = desc.type === "answer";
  try { await pc.setRemoteDescription(desc); }
  finally { state.isSettingRemoteAnswerPending = false; }
}
/* endregion */

/* region: SDP flows with PN + backoff */
async function callerFlow(sid: number, curSdpTag?: string | null) {
  if (!checkSession(sid) || !state.pc) return;
  ensureCallerOnly("caller-flow");

  if (jsonSizeUtf8(await state.pc.createOffer({})) > 200 * 1024) {
    logRtc("offer-too-large", 413); return;
  }

  state.makingOffer = true;
  const offer = await state.pc.createOffer();
  try { await state.pc.setLocalDescription(offer); }
  finally { state.makingOffer = false; }

  // POST offer (idempotent)
  const H2 = rtcHeaders({ pairId: state.pairId || undefined, role: state.role || undefined, sdpTag: curSdpTag || undefined });
  await apiSafeFetch("/api/rtc/offer", {
    method: "POST",
    headers: { "content-type": "application/json", ...H2 },
    body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(offer) })
  }).catch(() => {});

  // Poll answer with backoff
  let backoff = 300;
  for (let tries = 0; checkSession(sid) && !state.ac?.signal.aborted && tries < 50; tries++) {
    const H = rtcHeaders({ pairId: state.pairId || undefined, role: state.role || undefined, sdpTag: curSdpTag || undefined });
    const r = await apiSafeFetch("/api/rtc/answer", { method: "GET", cache: "no-store", headers: { ...H } });
    if (!r || !checkSession(sid)) return;
    if (r.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) { await applyRemoteDescriptionPN(JSON.parse(sdp), /*polite*/ false); logRtc("answer-received", 200); break; }
    }
    await sleep(backoff + Math.floor(Math.random() * 200));
    backoff = Math.min(backoff * 1.5, 1200);
  }
}

async function calleeFlow(sid: number, curSdpTag?: string | null) {
  if (!checkSession(sid) || !state.pc) return;
  ensureCalleeOnly("callee-flow");

  let backoff = 300;
  for (let tries = 0; checkSession(sid) && !state.ac?.signal.aborted && tries < 50; tries++) {
    const H = rtcHeaders({ pairId: state.pairId || undefined, role: state.role || undefined, sdpTag: curSdpTag || undefined });
    const r = await apiSafeFetch("/api/rtc/offer", { method: "GET", cache: "no-store", headers: { ...H } });
    if (!r || !checkSession(sid)) return;
    if (r.status === 200) {
      const { sdp } = await r.json().catch(() => ({}));
      if (sdp) {
        await applyRemoteDescriptionPN(JSON.parse(sdp), /*polite*/ true);
        // create answer
        const answer = await state.pc.createAnswer();
        await state.pc.setLocalDescription(answer);
        // POST answer (idempotent)
        const H2a = rtcHeaders({ pairId: state.pairId || undefined, role: state.role || undefined, sdpTag: curSdpTag || undefined });
        await apiSafeFetch("/api/rtc/answer", {
          method: "POST",
          headers: { "content-type": "application/json", ...H2a },
          body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(answer) })
        }).catch(() => {});
        break;
      }
    }
    await sleep(backoff + Math.floor(Math.random() * 200));
    backoff = Math.min(backoff * 1.5, 1200);
  }
}
/* endregion */

/* region: ICE exchange */
async function iceExchange(sid: number, curSdpTag?: string | null) {
  if (!checkSession(sid) || !state.pc) return;

  state.pc.onicecandidate = async (e) => {
    if (!e.candidate || !checkSession(sid) || state.ac?.signal.aborted) return;
    const H = rtcHeaders({ pairId: state.pairId || undefined, role: state.role || undefined, sdpTag: curSdpTag || undefined });
    // حماية حجم ICE ~4KB تتم في السيرفر أيضًا
    await apiSafeFetch("/api/rtc/ice", {
      method: "POST",
      headers: { "content-type": "application/json", ...H },
      body: JSON.stringify({ pairId: state.pairId, candidate: e.candidate })
    }).catch(() => {});
  };

  let backoff = 300;
  for (let tries = 0; checkSession(sid) && !state.ac?.signal.aborted && tries < 120; tries++) {
    const H = rtcHeaders({ pairId: state.pairId || undefined, role: state.role || undefined, sdpTag: curSdpTag || undefined });
    const r = await apiSafeFetch("/api/rtc/ice", { method: "GET", cache: "no-store", headers: { ...H } });
    if (!r || !checkSession(sid)) return;
    if (r.status === 200) {
      const items = await r.json().catch(() => ([]));
      if (Array.isArray(items)) {
        for (const it of items) {
          const cand = it?.cand || it?.candidate || it;
          try { await state.pc!.addIceCandidate(cand); logRtc("ice-added", 200); } catch (e) { logRtc("ice-add-error", 500, { error: String(e) }); }
        }
      }
    }
    await sleep(backoff + Math.floor(Math.random() * 200));
    backoff = Math.min(backoff * 1.5, 1500);
  }
}
/* endregion */

/* region: main start */
export async function start(media: MediaStream | null, onPhase: (phase: Phase) => void) {
  try {
    stop(); // guard
    const currentSession = ++session;
    state.sid = currentSession;
    state.phase = "searching";
    onPhaseCallback = onPhase;
    onPhase("searching");
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "searching", role: null } }));
    state.ac = new AbortController();
    logRtc("flow-start", 200);

    // init anon cookie
    try { await apiSafeFetch("/api/anon/init", { method: "GET", cache: "no-store", signal: state.ac.signal }); } catch (e) { swallowAbort(e); }

    // enqueue
    const curSdpTag: string | null = null;
    const t = Date.now(); __kpi.tEnq = (typeof performance !== "undefined" ? performance.now() : t);
    const HEnq = rtcHeaders({ pairId: state.pairId || undefined, role: state.role || undefined, sdpTag: curSdpTag || undefined });
    await apiSafeFetch("/api/rtc/enqueue", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ditona-session": String(currentSession), ...HEnq },
      body: JSON.stringify({ t })
    }).catch(() => {});

    // matchmake
    for (let i = 0; i < 50 && checkSession(currentSession) && !state.ac?.signal.aborted; i++) {
      const matchmakeOptions: RequestInit = { method: "POST", cache: "no-store", headers: { "content-type": "application/json" } };
      let filters: any = {};
      try {
        const { useFilters } = await import("@/state/filters");
        const { gender, countries } = useFilters.getState();
        filters = { gender: gender === "all" ? null : gender, countries: countries?.length ? countries : null };
      } catch {}
      const payload: any = { ...filters };
      if (state.prevForOnce) { payload.prevFor = state.prevForOnce; state.prevForOnce = null; }

      const HMm = rtcHeaders({ pairId: state.pairId || undefined, role: state.role || undefined, sdpTag: curSdpTag || undefined });
      matchmakeOptions.headers = { ...matchmakeOptions.headers, "x-ditona-step": "matchmake", "x-ditona-session": String(currentSession), ...HMm };
      matchmakeOptions.body = JSON.stringify(payload);

      const r = await apiSafeFetch("/api/rtc/matchmake", matchmakeOptions);
      if (!r || !checkSession(currentSession)) return;

      if (r.status === 200) {
        const j = await r.json().catch(() => ({}));
        if (j?.pairId && j?.role) {
          state.pairId = j.pairId; state.role = j.role; state.phase = "matched";
          state.polite = (state.role === "callee"); // PN: callee polite
          state.makingOffer = false; state.ignoreOffer = false; state.isSettingRemoteAnswerPending = false;

          try { __ditonaSetPair(state.pairId || undefined, state.role); } catch {}
          if (j.peerAnonId) state.lastPeer = j.peerAnonId;
          onPhase("matched");
          if (typeof window !== "undefined") {
            window.localStorage.setItem("ditona_pair", j.pairId);
            window.localStorage.setItem("ditona_role", j.role);
            window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId: j.pairId, role: j.role } }));
            window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "matched", role: j.role } }));
            // Reset UI state لهذا الزوج الجديد
            window.dispatchEvent(new CustomEvent("ditona:chat:reset"));
            window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked: false } }));
          }
          __kpi.tMatched = (typeof performance !== "undefined" ? performance.now() : Date.now());
          logRtc("match-found", 200, { role: state.role });
          break;
        }
      }
      await sleep(300 + Math.floor(Math.random() * 500));
    }

    if (!state.pairId || !state.role || !checkSession(currentSession)) { stop(); return; }

    // PC + TURN
    const iceServers = await getIceServers();
    state.pc = new RTCPeerConnection({ iceServers });

    // Perfect Negotiation events
    state.pc.onnegotiationneeded = async () => {
      if (!checkSession(currentSession) || !state.pc) return;
      try {
        state.makingOffer = true;
        const offer = await state.pc.createOffer();
        await state.pc.setLocalDescription(offer);
      } catch (e) { logRtc("pn-onnegotiationneeded", 500, { error: String(e) }); }
      finally { state.makingOffer = false; }
      // السيرفر يحمي الإديمبوتنسي؛ callerFlow سيقوم بالـPOST
      if (state.role === "caller") { try { await callerFlow(currentSession, null); } catch (e) { swallowAbort(e); } }
    };

    // AUTO_NEXT via env
    const AUTO_NEXT_MS = parseInt(process.env.NEXT_PUBLIC_AUTO_NEXT_MS || "0", 10);
    if (AUTO_NEXT_MS > 0) {
      let autoNextTimer: any = null;
      state.pc.addEventListener("connectionstatechange", () => {
        const st = state.pc?.connectionState;
        if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }
        if (st === "disconnected" || st === "failed") {
          autoNextTimer = setTimeout(() => { if (typeof window !== "undefined") window.dispatchEvent(new Event("ui:next")); }, AUTO_NEXT_MS);
        }
      });
    }

    // DC
    if (state.role === "caller") { const dc = state.pc.createDataChannel("likes"); setupDataChannel(dc); }
    state.pc.ondatachannel = (ev) => setupDataChannel(ev.channel);

    // connection state + metrics
    state.pc.onconnectionstatechange = () => {
      try { const st = (state.pc as any).connectionState; if (st === "disconnected" || st === "failed") scheduleRestartIce(); } catch {}
      if (!checkSession(currentSession) || !state.pc) return;
      const cs = state.pc.connectionState; logRtc("connection-state", 200, { connectionState: cs });
      if (cs === "connected") {
        if (__kpi.reconnectStart) {
          __kpi.reconnectDone = (typeof performance !== "undefined" ? performance.now() : Date.now());
          sendRtcMetrics({
            ts: Date.now(), sessionId: __kpi.sessionId, pairId: state.pairId || undefined, role: state.role || undefined,
            reconnectMs: (__kpi.reconnectDone - __kpi.reconnectStart), iceOk: true, iceTries: __kpi.iceTries,
            turns443: hasTurns443FromPc(state.pc), turns443First: hasTurns443First(state.pc),
          });
          __kpi.reconnectStart = 0;
        }
        state.phase = "connected"; onPhase("connected");
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "connected", role: state.role } }));
      } else if (cs === "disconnected" || cs === "failed") {
        __kpi.iceTries++; __kpi.reconnectStart = (typeof performance !== "undefined" ? performance.now() : Date.now());
      } else if (cs === "closed") {
        stop();
      }
    };

    // remote media
    state.pc.ontrack = (ev) => {
      if (!checkSession(currentSession)) return;
      const stream = ev.streams?.[0] || new MediaStream([ev.track]);
      if (typeof window !== "undefined") {
        const remote = document.getElementById("remoteVideo") as HTMLVideoElement | null;
        if (remote) { remote.srcObject = stream; remote.muted = true; remote.playsInline = true; (remote as any).autoplay = true; remote.play?.().catch(() => {}); }
        window.dispatchEvent(new CustomEvent("rtc:remote-track", { detail: { stream } }));
      }
      if (!__kpi.tFirstRemote) {
        __kpi.tFirstRemote = (typeof performance !== "undefined" ? performance.now() : Date.now());
        sendRtcMetrics({
          ts: Date.now(), sessionId: __kpi.sessionId, pairId: state.pairId || undefined, role: state.role || undefined,
          matchMs: __kpi.tMatched ? (__kpi.tMatched - __kpi.tEnq) : undefined,
          ttfmMs: (__kpi.tFirstRemote - (__kpi.tMatched || __kpi.tEnq)),
          iceOk: true, iceTries: __kpi.iceTries,
          turns443: hasTurns443FromPc(state.pc), turns443First: hasTurns443First(state.pc),
        });
      }
      logRtc("track-received", 200);
    };

    // local media
    if (media) media.getTracks().forEach(tr => state.pc?.addTrack(tr, media));

    // ICE + SDP
    await iceExchange(currentSession, null);
    if (state.role === "caller") await callerFlow(currentSession, null);
    else await calleeFlow(currentSession, null);

    // debug
    if (typeof window !== "undefined") {
      (window as any).ditonaPC = state.pc;
      (window as any).ditonaTurns443First = () => hasTurns443First(state.pc);
      (window as any).ditonaTurns443Present = () => hasTurns443FromPc(state.pc);
    }
  } catch (e: any) {
    if (e?.name === "AbortError") logRtc("flow-aborted", 499);
    else { logRtc("flow-error", 500, { error: e?.message }); console.warn("RTC flow error", e); }
    stop();
  }
}
/* endregion */

/* region: next */
export async function next() {
  if (cooldownNext) return;
  cooldownNext = true;
  try {
    try { stop("network"); } catch {}
    await sleep(700);
    const local = getLocalStream?.();
    if (local && onPhaseCallback) await start(local, onPhaseCallback);
  } finally { cooldownNext = false; }
}
export async function nextWithMedia(media: MediaStream) {
  stop();
  if (onPhaseCallback) await start(media, onPhaseCallback);
}
/* endregion */

/* region: DC */
function setupDataChannel(dc: RTCDataChannel) {
  dc.onopen = () => {
    logRtc("datachannel-open", 200);
    (globalThis as any).__ditonaDataChannel = dc;
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rtc:phase", { detail: { phase: "dc-open" } }));
    // Reset رسائل/Like فور فتح القناة لزوج جديد
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ditona:chat:reset"));
        window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked: false } }));
      }
    } catch {}
    try { dc.send(JSON.stringify({ type: "meta:init" })); setTimeout(() => dc?.send?.(JSON.stringify({ type: "meta:init" })), 300); setTimeout(() => dc?.send?.(JSON.stringify({ type: "meta:init" })), 1200); } catch {}
  };
  dc.onmessage = async (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "meta:init") {
        const sendImmediate = async () => {
          let country = "Unknown", city = "Unknown", gender = "Unknown", name = "Anonymous";
          try { const { getImmediateGeo } = await import("@/lib/geoCache"); const g = getImmediateGeo(); country = g.country; city = g.city; } catch {}
          try { if (typeof window !== "undefined") { const { useProfile } = await import("@/state/profile"); const p = useProfile.getState().profile; gender = p.gender || "Unknown"; name = p.displayName || "Anonymous"; } } catch {}
          const meta = { country, city, gender, name, avatar: null, likes: 0 };
          try { dc.send(JSON.stringify({ type: "meta", payload: meta })); } catch {} return meta;
        };
        sendImmediate().then(async (initial) => {
          try {
            const { fetchGeoWithCache } = await import("@/lib/geoCache");
            const fresh = await fetchGeoWithCache();
            if (fresh.country !== initial.country || fresh.city !== initial.city) {
              const upd = { ...initial, country: fresh.country || "Unknown", city: fresh.city || "Unknown" };
              try { dc.send(JSON.stringify({ type: "meta", payload: upd })); } catch {}
            }
          } catch {}
        });
        return;
      }
      if (msg.type === "meta" && msg.payload) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: msg.payload }));
        return;
      }
      if (msg?.t === "chat" && msg?.pairId === state.pairId) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ditona:chat:recv", { detail: { text: String(msg.text || "") } }));
        return;
      }
      if (msg.type === "like:toggle" || (msg.t === "like" && msg.pairId === state.pairId)) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked: !!msg.liked } }));
      }
    } catch {}
  };
  dc.onerror = (e) => { console.warn("[rtc] DataChannel error:", e); };
  dc.onclose = () => {
    logRtc("datachannel-close", 200);
    try {
      (globalThis as any).__ditonaDataChannel = null;
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ditona:datachannel-closed"));
    } catch {}
  };
}
/* endregion */

/* region: legacy + utils */
export function startRtcFlowOnce() {
  const local = getLocalStream();
  if (local && onPhaseCallback) start(local, onPhaseCallback);
}
export function stopRtcSession(reason: string = "user") { logRtc("session-stop", 200, { reason }); stop(); }
function __ditonaSetPair(pid?: string, role?: any) {
  try {
    (window as any).__ditonaPairId = pid ?? null;
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rtc:pair", { detail: { pairId: pid ?? null, role } }));
  } catch {}
}
try {
  window.addEventListener("ui:prev", () => { try { state.prevForOnce = state.lastPeer; } catch {} try { next(); } catch {} });
} catch {}
let __iceRestartTimer: any = null;
function scheduleRestartIce() {
  try {
    if (__iceRestartTimer) return;
    __iceRestartTimer = setTimeout(async () => {
      __iceRestartTimer = null;
      try {
        if (!state?.pc || state?.ac?.signal?.aborted) return;
        if (typeof state.pc.restartIce === "function") await state.pc.restartIce();
        else { try { await state.pc.setLocalDescription(await state.pc.createOffer({ iceRestart: true })); } catch {} }
      } catch (e) { try { swallowAbort(e); } catch {} }
    }, 700);
  } catch {}
}
/* endregion */
