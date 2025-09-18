/* Anti-leak WebRTC flow with session stamping and phase tracking */
function safeAbort(ac?: AbortController|null){ try{ if(ac && !ac.signal?.aborted) ac.abort("stop"); }catch{} }
if (typeof window!=="undefined" && process.env.NODE_ENV!=="production"){
  try{ window.addEventListener("unhandledrejection",(e:any)=>{ if((e?.reason?.name||"")==="AbortError"){ e.preventDefault?.(); } }); }catch{}
}
import { getLocalStream } from "@/lib/media";
import { sendRtcMetrics, type RtcMetrics } from '@/utils/metrics';

const isAbort = (e:any)=> e && (e.name==='AbortError' || e.code===20);
const swallowAbort = (e:any)=> { if(!isAbort(e)) throw e; };

// Sleep helper and cooldown tracking
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
let cooldownNext = false;

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
      // Accept both turns: and turn: on port 443 (turn:443 is functionally equivalent to turns for firewall traversal)
      if (urls?.some((u: string) => /^turns?:.*:443(\?|$)/i.test(String(u)))) return true;
    }
  } catch {}
  return false;
}

// Check if the first ICE server is TURNS:443 or TURN:443 (functionally equivalent)
function hasTurns443First(pc: RTCPeerConnection | null | undefined): boolean {
  try {
    const cfg = pc?.getConfiguration?.();
    const arr = Array.isArray(cfg?.iceServers) ? cfg!.iceServers : [];
    if (arr.length === 0) return false;
    
    const firstServer = arr[0];
    const urls = Array.isArray((firstServer as any).urls) ? (firstServer as any).urls : [(firstServer as any).urls];
    // Accept both turns: and turn: on port 443 (turn:443 is functionally equivalent to turns for firewall traversal)
    return urls?.some((u: string) => /^turns?:.*:443(\?|$)/i.test(String(u))) || false;
  } catch {}
  return false;
}

// Reorder ICE servers to prioritize TURNS:443
function reorderIceServers(servers: any[]): any[] {
  if (!Array.isArray(servers) || servers.length === 0) return servers;
  
  const turns443: any[] = [];
  const turn443: any[] = [];
  const turn3478: any[] = [];
  const stun: any[] = [];
  const other: any[] = [];
  
  for (const server of servers) {
    const urls = Array.isArray((server as any).urls) ? (server as any).urls : [(server as any).urls];
    
    // Check if any URL in this server is TURNS:443 or TURN:443 (both prioritized for port 443 firewall traversal)
    const hasTurns443Url = urls?.some((u: string) => /^turns?:.*:443(\?|$)/i.test(String(u)));
    if (hasTurns443Url) {
      turns443.push(server);
      continue;
    }
    
    // Check if any URL in this server is TURN:443
    const hasTurn443Url = urls?.some((u: string) => /^turn:.*:443(\?|$)/i.test(String(u)));
    if (hasTurn443Url) {
      turn443.push(server);
      continue;
    }
    
    // Check if any URL in this server is TURN:3478
    const hasTurn3478Url = urls?.some((u: string) => /^turn:.*:3478(\?|$)/i.test(String(u)));
    if (hasTurn3478Url) {
      turn3478.push(server);
      continue;
    }
    
    // Check if any URL in this server is STUN
    const hasStunUrl = urls?.some((u: string) => /^stuns?:/i.test(String(u)));
    if (hasStunUrl) {
      stun.push(server);
      continue;
    }
    
    // Everything else
    other.push(server);
  }
  
  // Return in priority order: TURNS:443, TURN:443, TURN:3478, STUN, others
  return [...turns443, ...turn443, ...turn3478, ...stun, ...other];
}

// Session counter for leak prevention
let session = 0;

// Phase tracking
type Phase = 'idle' | 'searching' | 'matched' | 'connected' | 'stopped';

// State machine
interface RtcState {
    remoteStream: MediaStream | null;
sid: number;
  phase: Phase;
  role: 'caller' | 'callee' | null;
  pairId: string | null;
  ac: AbortController | null;
  pc: RTCPeerConnection | null;
  lastPeer: string | null;
  prevForOnce: string | null;
}

let state: RtcState = {
    remoteStream: null,
sid: 0,
  phase: 'idle',
  role: null,
  pairId: null,
  ac: null,
  pc: null,
  lastPeer: null,
  prevForOnce: null
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
export function stop(mode: "full"|"network" = "full"){
  try{
    // abort any pending ops
    try{ safeAbort(state.ac); }catch{} 
    state.ac = null;

    // network-only partial stop: close pc + remote, keep local preview
    if (mode !== "full"){
      try{ state.pc?.close(); }catch{}
      state.pc = null;
      try{ state.remoteStream?.getTracks().forEach(t=>t.stop()); }catch{}
      state.remoteStream = null;
      logRtc("stop", 206);
      return;
    }

    // full stop: send metrics while pc is still alive
    try{ if (state.pairId && state.pc){ collectAndSendMetrics(); } }catch{}

    // close peer and stop remote tracks
    try{ state.pc?.getSenders?.().forEach(s=>{ try{ s.track?.stop(); }catch{} }); }catch{}
    try{ state.pc?.close(); }catch{}
    state.pc = null;
    try{ state.remoteStream?.getTracks().forEach(t=>t.stop()); }catch{}
    state.remoteStream = null;

    // hint prev-for once
    try{
      const peer = (state && (state.lastPeer||null)) as any;
      if(peer){
        fetch("/api/rtc/prev/for", {
          method:"POST",
          headers:{ "content-type":"application/json" },
          body: JSON.stringify({ peer })
        }).catch(()=>{});
      }
    }catch{}

    // phase + event
    state.phase = "stopped";
    try{ onPhaseCallback?.("stopped"); }catch{}
    if (typeof window !== "undefined"){
      window.dispatchEvent(new CustomEvent("rtc:phase",{ detail:{ phase:"idle", role:null }}));
    }

    // clear and reset
    clearLocalStorage();
    state.sid = 0;
    state.phase = "idle";
    state.role = null;
    state.pairId = null;

    logRtc("stop", 200);
  }catch(e){
    console.warn("[rtc] stop error:", e);
  }
}


// Collect and send metrics
  
async function collectAndSendMetrics() {
  if (!state.pc || !state.pairId) return;
  
  try {
    const stats = await state.pc.getStats();
    let candidateType = '';
    let rtt = 0;
    let turn443Used = false;
    
    stats.forEach((stat) => {
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        candidateType = stat.remoteCandidateId || '';
      }
      if (stat.type === 'remote-candidate') {
        if (stat.port === 443 || stat.relayProtocol) turn443Used = true;
        if (stat.candidateType) candidateType = stat.candidateType;
      }
      if (stat.type === 'transport' && typeof stat.currentRoundTripTime === 'number') {
        rtt = stat.currentRoundTripTime * 1000; // Convert to ms
      }
    });

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const ttfm = __kpi.tFirstRemote ? (now - __kpi.tFirstRemote) : 0;
    const duration = __kpi.tMatched ? (now - __kpi.tMatched) : 0;

    const metrics = {
      ts: Date.now(),
      sessionId: __kpi.sessionId,
      pairId: state.pairId,
      role: state.role,
      matchMs: duration,
      ttfmMs: ttfm,
      reconnectMs: 0,
      iceOk: candidateType !== '',
      iceTries: 1,
      turns443: turn443Used,
      prevUsed: !!state.lastPeer
    };

    await fetch('/api/monitoring/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics)
    }).catch(() => {});

  } catch (error) {
    console.warn('[rtc] Failed to collect metrics:', error);
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
  let response: Response;
  try {
    response = await fetch(url, { ...options, signal });
  } catch(e){ swallowAbort(e); return null; }
  
  logRtc(operation, response.status);
  
  if (response.status === 403) {
    console.warn('[rtc]', state.role, '403 at', operation);
    // Don't call stop() immediately to prevent recursion
    state.phase = 'idle';
    if (onPhaseCallback) onPhaseCallback('idle');
    return null;
  }
  
  return response;
}

// Get ICE servers from API or fallback, reordered by priority
async function getIceServers() {
  try {
    const response = await fetch('/api/turn', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      const servers = data.iceServers || [{ urls: "stun:stun.l.google.com:19302" }];
      return reorderIceServers(servers);
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
    
    // Broadcast initial phase event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent('rtc:phase',{detail:{phase:'searching',role:null}}));
    }
    
    // Create new AbortController
    state.ac = new AbortController();
    
    logRtc('flow-start', 200);

    // Initialize anon cookie
    try {
      await fetch("/api/anon/init", { 
        method: "GET", 
        cache: "no-store",
        signal: state.ac.signal 
      });
    } catch(e){ swallowAbort(e); }

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
      // Prepare matchmake request with prevFor if available
      const matchmakeOptions: RequestInit = {
        method: "POST", 
        cache: "no-store"
      };
      
      if (state.prevForOnce) {
        matchmakeOptions.headers = { "content-type": "application/json" };
        matchmakeOptions.body = JSON.stringify({ prevFor: state.prevForOnce });
        // Clear prevForOnce after use
        state.prevForOnce = null;
      }
      
      const response = await safeFetch("/api/rtc/matchmake", matchmakeOptions, 'matchmake', currentSession);
      
      if (!response || !checkSession(currentSession)) return;
      
      if (response.status === 200) {
        const j = await response.json().catch(() => ({}));
        
        // Support both formats: {pairId, role} and {found:true, pairId, role}
        if (j?.pairId && j?.role) {
          state.pairId = j.pairId;
          state.role = j.role;
          state.phase = 'matched';
          // Save peer for potential "prev" functionality
          if (j.peerAnonId) {
            state.lastPeer = j.peerAnonId;
          }
          onPhase('matched');
          
          // Store in localStorage for recovery
          if (typeof window !== "undefined") {
            window.localStorage.setItem("ditona_pair", j.pairId);
            window.localStorage.setItem("ditona_role", j.role);
            
            // Broadcast pair and phase events
            window.dispatchEvent(new CustomEvent('rtc:pair',{detail:{pairId:j.pairId,role:j.role}}));
            window.dispatchEvent(new CustomEvent('rtc:phase',{detail:{phase:'matched',role:j.role}}));
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
    
    // Setup DataChannel for real-time communication
    if (state.role === 'caller') {
      const dc = state.pc.createDataChannel('likes');
      setupDataChannel(dc);
    }
    
    // Setup connection state monitoring
    // Handle incoming DataChannel
    state.pc.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };
    
    state.pc.onconnectionstatechange = () => {
       try{const st=(state.pc as any).connectionState; if(st==="disconnected"||st==="failed"){ scheduleRestartIce(); }}catch{} if (!checkSession(currentSession) || !state.pc) return;
      
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
            turns443First: hasTurns443First(state.pc),
          });
          __kpi.reconnectStart = 0;
        }
        state.phase = 'connected';
        onPhase('connected');
        
        // Broadcast connected phase event
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent('rtc:phase',{detail:{phase:'connected',role:state.role}}));
        }
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
        
        // Broadcast remote track event
        window.dispatchEvent(new CustomEvent('rtc:remote-track',{detail:{stream:stream}}));
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
          turns443First: hasTurns443First(state.pc),
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
      
      // Expose verification functions for debugging
      (window as any).ditonaTurns443First = () => hasTurns443First(state.pc);
      (window as any).ditonaTurns443Present = () => hasTurns443FromPc(state.pc);
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


// Next function with cooldown: stop current session network-only, wait, then start new one
export async function next(){
  if (cooldownNext) return;
  cooldownNext = true;
  try {
    try { stop("network"); } catch {}
    await sleep(700);
    const localStream = getLocalStream?.();
    if (localStream && onPhaseCallback) {
      await start(localStream, onPhaseCallback);
    }
  } finally {
    cooldownNext = false;
  }
}

// Legacy next function for backward compatibility
export async function nextWithMedia(media: MediaStream) {
  stop();
  if (onPhaseCallback) {
    await start(media, onPhaseCallback);
  }
}

// DataChannel setup for real-time likes
function setupDataChannel(dc: RTCDataChannel) {
  dc.onopen = () => {
    logRtc('datachannel-open', 200);
    // Store reference for sending data
    (globalThis as any).__ditonaDataChannel = dc;
  };
  
  dc.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg?.t === "chat" && msg?.pairId === state.pairId) {
        window.dispatchEvent(new CustomEvent('ditona:chat:recv', { detail: { text: String(msg.text || "") } }));
        return;
      }
      if (msg.t === "like" && msg.pairId === state.pairId) {
        // Broadcast like event to UI
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent('rtc:peer-like', { detail: { liked: !!msg.liked } }));
        }
      }
    } catch {}
  };
  
  dc.onerror = (error) => {
    console.warn('[rtc] DataChannel error:', error);
  };
  
  dc.onclose = () => {
    logRtc('datachannel-close', 200);
    (globalThis as any).__ditonaDataChannel = null;
  };
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


try{
  window.addEventListener("ui:prev", ()=>{
    try{ state.prevForOnce = state.lastPeer; }catch{}
    try{ next(); }catch{}
  });
}catch{}
/** Debounced ICE restart on transient drops */
let __iceRestartTimer: any = null;
function scheduleRestartIce() {
  try {
    if (__iceRestartTimer) return;
    __iceRestartTimer = setTimeout(async () => {
      __iceRestartTimer = null;
      try {
        if (!state?.pc || state?.ac?.signal?.aborted) return;
        if (typeof state.pc.restartIce === 'function') {
          await state.pc.restartIce();
        } else {
          try {
            await state.pc.setLocalDescription(
              await state.pc.createOffer({ iceRestart: true })
            );
          } catch {}
        }
      } catch(e) { try{ swallowAbort(e); }catch{} }
    }, 700);
  } catch {}
}
