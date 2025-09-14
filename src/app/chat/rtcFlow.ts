/* Anti-leak WebRTC flow with session stamping and phase tracking */
import { getLocalStream } from "@/lib/media";
import { sendRtcMetrics, type RtcMetrics } from '@/utils/metrics';

const isAbort = (e:any)=> e && (e.name==='AbortError' || e.code===20);
const swallowAbort = (e:any)=> { if(!isAbort(e)) throw e; };

const __kpi = {
  tEnq: 0, tMatched: 0, tFirstRemote: 0,
  reconnectStart: 0, reconnectDone: 0,
  iceTries: 0,
  sessionId: (typeof crypto!=='undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : String(Date.now()),
};

function hasTurns443FromPc(pc: RTCPeerConnection | null | undefined): boolean {
  try {
    const cfg = pc?.getConfiguration?.();
    const arr = Array.isArray(cfg?.iceServers) ? cfg!.iceServers : [];
    for (const s of arr) {
      const urls = Array.isArray((s as any).urls) ? (s as any).urls : [(s as any).urls];
      if (urls?.some((u: string) => /^turns:.*:443(\?|$)/i.test(String(u)))) return true;
    }
  } catch {}
  return false;
}

// Session counter for leak prevention
let session = 0;

// Phase tracking
type Phase = 'idle' | 'searching' | 'matched' | 'connected' | 'stopped';

// State machine
interface RtcState {
  sid: number;
  phase: Phase;
  role: 'caller' | 'callee' | null;
  pairId: string | null;
  ac: AbortController | null;
  pc: RTCPeerConnection | null;
}

let state: RtcState = {
  sid: 0,
  phase: 'idle',
  role: null,
  pairId: null,
  ac: null,
  pc: null
};

// Phase callback
let onPhaseCallback: ((phase: Phase) => void) | null = null;

// Telemetry logging
function logRtc(op: string, code: number, extra?: any) {
  console.log('[rtc]', {
    sid: state.sid,
    phase: state.phase,
    role: state.role,
    op,
    code,
    pair: state.pairId,
    ...extra
  });
}

// Session guard - ensures operations belong to current session
function checkSession(sessionId: number): boolean {
  return sessionId === session;
}

// Clear localStorage keys
function clearLocalStorage() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("ditona_role");
    window.localStorage.removeItem("ditona_pair");
    window.localStorage.removeItem("ditona_ice_sent");
  }
}

// Complete cleanup and stop
export function stop() {
  try {
    // Update phase
    state.phase = 'stopped';
    if (onPhaseCallback) onPhaseCallback('stopped');

    // Abort any ongoing requests
    if (state.ac) { try { state.ac.abort(); } catch {} }
    state.ac = null;

    // Close peer connection and stop tracks
    if (state.pc) {
      try {
        state.pc.getSenders?.().forEach(sender => {
          try {
            if (sender.track) sender.track.stop();
          } catch {}
        });
        state.pc.close();
      } catch {}
      state.pc = null;
    }

    // Clear localStorage
    clearLocalStorage();

    // Reset state
    state.sid = 0;
    state.phase = 'idle';
    state.role = null;
    state.pairId = null;

    logRtc('stop', 200);
  } catch (e) {
    console.warn('[rtc] stop error:', e);
  }
}

// Role guards to prevent 403 errors
function ensureCallerOnly(operation: string) {
  if (state.role !== 'caller') {
    const error = new Error(`${operation} forbidden for role: ${state.role}`);
    logRtc(operation, 403, { reason: 'role-guard-caller' });
    throw error;
  }
}

function ensureCalleeOnly(operation: string) {
  if (state.role !== 'callee') {
    const error = new Error(`${operation} forbidden for role: ${state.role}`);
    logRtc(operation, 403, { reason: 'role-guard-callee' });
    throw error;
  }
}

// Safe fetch with session checking and telemetry
async function safeFetch(url: string, options: RequestInit = {}, operation: string, sessionId: number) {
  if (!checkSession(sessionId)) {
    logRtc(operation, 499, { reason: 'session-mismatch' });
    return null;
  }

  const signal = state.ac?.signal;
  try {
    const response = await fetch(url, { ...options, signal });
    logRtc(operation, response.status);
    
    if (response.status === 403) {
      console.warn('[rtc]', state.role, '403 at', operation);
      // Don't call stop() immediately to prevent recursion
      state.phase = 'idle';
      if (onPhaseCallback) onPhaseCallback('idle');
      return null;
    }
    
    return response;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      logRtc(operation, 499, { reason: 'aborted' });
    } else {
      logRtc(operation, 500, { error: e.message });
    }
    return null;
  }
}

// Get ICE servers from API or fallback
async function getIceServers() {
  try {
    const response = await fetch('/api/turn', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      return data.iceServers || [{ urls: "stun:stun.l.google.com:19302" }];
    }
  } catch {}
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

// Caller flow: createOffer → POST /offer → poll GET /answer → setRemote
async function callerFlow(sessionId: number) {
  if (!checkSession(sessionId)) return;
  
  ensureCallerOnly('caller-flow');
  
  if (!state.pc) return;

  // Create and set local offer
  const offer = await state.pc.createOffer();
  await state.pc.setLocalDescription(offer);
  
  // POST offer
  const offerResponse = await safeFetch("/api/rtc/offer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(offer) }),
  }, 'post-offer', sessionId);

  if (!offerResponse || !checkSession(sessionId)) return;

  // Poll for answer
  while (checkSession(sessionId) && !state.ac?.signal.aborted) {
    const answerResponse = await safeFetch(
      `/api/rtc/answer?pairId=${encodeURIComponent(String(state.pairId))}`,
      { cache: "no-store" },
      'poll-answer',
      sessionId
    );
    
    if (!answerResponse || !checkSession(sessionId)) return;
    
    if (answerResponse.status === 200) {
      const { sdp } = await answerResponse.json().catch(() => ({}));
      if (sdp) {
        await state.pc?.setRemoteDescription(JSON.parse(sdp));
        logRtc('answer-received', 200);
        break;
      }
    }
    
    await new Promise(res => setTimeout(res, 300 + Math.floor(Math.random() * 400)));
  }
}

// Callee flow: poll GET /offer → setRemote → createAnswer → POST /answer
async function calleeFlow(sessionId: number) {
  if (!checkSession(sessionId)) return;
  
  ensureCalleeOnly('callee-flow');
  
  if (!state.pc) return;

  // Poll for offer
  while (checkSession(sessionId) && !state.ac?.signal.aborted) {
    const offerResponse = await safeFetch(
      `/api/rtc/offer?pairId=${encodeURIComponent(String(state.pairId))}`,
      { cache: "no-store" },
      'poll-offer',
      sessionId
    );
    
    if (!offerResponse || !checkSession(sessionId)) return;
    
    if (offerResponse.status === 200) {
      const { sdp } = await offerResponse.json().catch(() => ({}));
      if (sdp) {
        await state.pc?.setRemoteDescription(JSON.parse(sdp));
        
        // Create and set local answer
        const answer = await state.pc?.createAnswer();
        if (answer) {
          await state.pc?.setLocalDescription(answer);
          
          // POST answer
          await safeFetch("/api/rtc/answer", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pairId: state.pairId, sdp: JSON.stringify(answer) }),
          }, 'post-answer', sessionId);
          
          logRtc('offer-answered', 200);
          break;
        }
      }
    }
    
    await new Promise(res => setTimeout(res, 300 + Math.floor(Math.random() * 400)));
  }
}

// ICE candidate exchange for both roles
async function iceExchange(sessionId: number) {
  if (!checkSession(sessionId) || !state.pc) return;

  // POST ICE candidates when generated
  state.pc.onicecandidate = async (e) => {
    if (!e.candidate || !checkSession(sessionId) || state.ac?.signal.aborted) return;
    
    await safeFetch("/api/rtc/ice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pairId: state.pairId, candidate: e.candidate }),
    }, 'post-ice', sessionId);
  };

  // Poll for remote ICE candidates
  const pollIce = async () => {
    while (checkSession(sessionId) && !state.ac?.signal.aborted) {
      const response = await safeFetch(
        `/api/rtc/ice?pairId=${encodeURIComponent(String(state.pairId))}`,
        { cache: "no-store" },
        'poll-ice',
        sessionId
      );
      
      if (!response || !checkSession(sessionId)) break;
      
      if (response.status === 200) {
        const candidates = await response.json().catch(() => []);
        
        // Handle both array format [{cand}] and single object format {candidate}
        const items = Array.isArray(candidates) ? candidates : [candidates];
        
        for (const item of items) {
          try {
            const candidate = item.cand || item.candidate;
            if (candidate && state.pc) {
              await state.pc.addIceCandidate(candidate);
              logRtc('ice-added', 200);
            }
          } catch (e) {
            logRtc('ice-add-error', 500, { error: e });
          }
        }
      }
      
      await new Promise(res => setTimeout(res, 350 + Math.floor(Math.random() * 350)));
    }
  };

  // Start ICE polling
  pollIce().catch(() => {});
}

// Main start function
export async function start(media: MediaStream, onPhase: (phase: Phase) => void) {
  try {
    // Always stop first to prevent leaks
    stop();
    
    // Increment session and setup
    const currentSession = ++session;
    state.sid = currentSession;
    state.phase = 'searching';
    onPhaseCallback = onPhase;
    onPhase('searching');
    
    // Create new AbortController
    state.ac = new AbortController();
    
    logRtc('flow-start', 200);

    // Initialize anon cookie
    await fetch("/api/anon/init", { 
      method: "GET", 
      cache: "no-store",
      signal: state.ac.signal 
    }).catch(() => {});

    // Enqueue
    __kpi.tEnq = (typeof performance!=='undefined' ? performance.now() : Date.now());
    __kpi.tMatched = 0; __kpi.tFirstRemote = 0;
    __kpi.reconnectStart = 0; __kpi.reconnectDone = 0; __kpi.iceTries = 0;
    const enqueueResponse = await safeFetch("/api/rtc/enqueue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }, 'enqueue', currentSession);

    if (!enqueueResponse || !checkSession(currentSession)) return;

    // Matchmake: support both response formats
    for (let i = 0; i < 50 && checkSession(currentSession) && !state.ac?.signal.aborted; i++) {
      const response = await safeFetch("/api/rtc/matchmake", { 
        method: "POST", 
        cache: "no-store" 
      }, 'matchmake', currentSession);
      
      if (!response || !checkSession(currentSession)) return;
      
      if (response.status === 200) {
        const j = await response.json().catch(() => ({}));
        
        // Support both formats: {pairId, role} and {found:true, pairId, role}
        if (j?.pairId && j?.role) {
          state.pairId = j.pairId;
          state.role = j.role;
          state.phase = 'matched';
          onPhase('matched');
          
          // Store in localStorage for recovery
          if (typeof window !== "undefined") {
            window.localStorage.setItem("ditona_pair", j.pairId);
            window.localStorage.setItem("ditona_role", j.role);
          }
          
          // Handle peer metadata
          if (typeof window !== "undefined") {
            try {
              if (j?.peerMeta) {
                window.localStorage.setItem("ditona:peer:meta", JSON.stringify(j.peerMeta));
                window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: j.peerMeta }));
              }
            } catch {}
          }
          
          __kpi.tMatched = (typeof performance!=='undefined' ? performance.now() : Date.now());
          const kpiBase: RtcMetrics = {
            ts: Date.now(),
            sessionId: __kpi.sessionId,
            pairId: j.pairId,
            role: j.role,
          };
          logRtc('match-found', 200, { role: state.role });
          break;
        }
      }
      
      await new Promise(res => setTimeout(res, 300 + Math.floor(Math.random() * 500)));
    }
    
    if (!state.pairId || !state.role || !checkSession(currentSession)) {
      stop();
      return;
    }

    // Create RTCPeerConnection with ICE servers
    const iceServers = await getIceServers();
    state.pc = new RTCPeerConnection({ iceServers });
    
    // Setup connection state monitoring
    state.pc.onconnectionstatechange = () => {
      if (!checkSession(currentSession) || !state.pc) return;
      
      const connectionState = state.pc.connectionState;
      logRtc('connection-state', 200, { connectionState });
      
      if (connectionState === 'connected') {
        if (__kpi.reconnectStart) {
          __kpi.reconnectDone = (typeof performance!=='undefined' ? performance.now() : Date.now());
          sendRtcMetrics({
            ts: Date.now(),
            sessionId: __kpi.sessionId,
            pairId: state.pairId || undefined,
            role: state.role || undefined,
            reconnectMs: (__kpi.reconnectDone - __kpi.reconnectStart),
            iceOk: true,
            iceTries: __kpi.iceTries,
            turns443: hasTurns443FromPc(state.pc),
          });
          __kpi.reconnectStart = 0;
        }
        state.phase = 'connected';
        onPhase('connected');
      } else if (['disconnected', 'failed'].includes(connectionState)) {
        __kpi.iceTries++;
        __kpi.reconnectStart = (typeof performance!=='undefined' ? performance.now() : Date.now());
      } else if (connectionState === 'closed') {
        stop();
      }
    };
    
    // Setup remote video
    state.pc.ontrack = (ev) => {
      if (!checkSession(currentSession)) return;
      
      const stream = ev.streams?.[0] || new MediaStream([ev.track]);
      if (typeof window !== "undefined") {
        const remote = document.getElementById("remoteVideo") as HTMLVideoElement | null;
        if (remote) {
          remote.srcObject = stream;
          remote.muted = true;
          remote.playsInline = true;
          remote.autoplay = true as any;
          remote.play?.().catch(() => {});
        }
      }
      
      if (!__kpi.tFirstRemote) {
        __kpi.tFirstRemote = (typeof performance!=='undefined' ? performance.now() : Date.now());
        sendRtcMetrics({
          ts: Date.now(),
          sessionId: __kpi.sessionId,
          pairId: state.pairId || undefined,
          role: state.role || undefined,
          matchMs: __kpi.tMatched ? (__kpi.tMatched - __kpi.tEnq) : undefined,
          ttfmMs: (__kpi.tFirstRemote - (__kpi.tMatched || __kpi.tEnq)),
          iceOk: true,
          iceTries: __kpi.iceTries,
          turns443: hasTurns443FromPc(state.pc),
        });
      }
      
      logRtc('track-received', 200);
    };
    
    // Add local tracks
    if (media) {
      media.getTracks().forEach(track => state.pc?.addTrack(track, media));
    }

    // Start ICE exchange
    iceExchange(currentSession);

    // Role-specific SDP exchange
    if (state.role === "caller") {
      await callerFlow(currentSession);
    } else {
      await calleeFlow(currentSession);
    }

    // Store PC reference for debugging
    if (typeof window !== "undefined") {
      (window as any).ditonaPC = state.pc;
    }
    
  } catch (e: any) {
    if (e.name === 'AbortError') {
      logRtc('flow-aborted', 499);
    } else {
      logRtc('flow-error', 500, { error: e.message });
      console.warn("RTC flow error", e);
    }
    stop();
  }
}

// Next function: stop current session then start new one
export async function next(media: MediaStream) {
  stop();
  if (onPhaseCallback) {
    await start(media, onPhaseCallback);
  }
}

// Legacy compatibility
export function startRtcFlowOnce() {
  const localStream = getLocalStream();
  if (localStream && onPhaseCallback) {
    start(localStream, onPhaseCallback);
  }
}

export function stopRtcSession(reason: string = "user") {
  logRtc('session-stop', 200, { reason });
  stop();
}