/* WebRTC client flow with role-based state machine and proper cleanup */
import { withFiltersBody } from "./filtersBridge";
import { getLocalStream } from "@/lib/media";

// State machine for RTC flow
interface RtcState {
  role: 'caller' | 'callee' | null;
  pairId: string | null;
  ac: AbortController | null;
  pc: RTCPeerConnection | null;
}

let rtcState: RtcState = {
  role: null,
  pairId: null,
  ac: null,
  pc: null
};

// Telemetry logging
function logRtc(op: string, code: number, extra?: any) {
  console.log('[rtc]', {
    role: rtcState.role,
    op,
    code,
    pair: rtcState.pairId,
    ...extra
  });
}

// Cleanup function - cancel AbortController, remove listeners, clear localStorage, close PC
export function cleanup() {
  try {
    // Abort any ongoing fetch operations
    if (rtcState.ac) {
      rtcState.ac.abort();
      rtcState.ac = null;
    }

    // Complete RTCPeerConnection cleanup
    if (rtcState.pc) {
      try {
        // Stop all senders' tracks
        rtcState.pc.getSenders().forEach(sender => {
          if (sender.track) {
            sender.track.stop();
          }
        });
        
        // Clear event handlers
        rtcState.pc.ontrack = null;
        rtcState.pc.onicecandidate = null;
        rtcState.pc.onconnectionstatechange = null;
        rtcState.pc.oniceconnectionstatechange = null;
        
        // Close the connection
        rtcState.pc.close();
      } catch (e) {
        console.warn('[rtc] PC cleanup error:', e);
      }
      rtcState.pc = null;
    }

    // Clear localStorage keys
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("ditona_role");
      window.localStorage.removeItem("ditona_pair");
      window.localStorage.removeItem("ditona_ice_sent");
    }

    // Reset state
    rtcState.role = null;
    rtcState.pairId = null;

    logRtc('cleanup', 200);
  } catch (e) {
    console.warn('[rtc] cleanup error:', e);
  }
}

// Role guards to prevent wrong endpoint access
function guardCallerOnly(operation: string) {
  if (rtcState.role !== 'caller') {
    const error = new Error(`${operation} forbidden for role: ${rtcState.role}`);
    logRtc(operation, 403, { reason: 'role-guard-caller' });
    throw error;
  }
}

function guardCalleeOnly(operation: string) {
  if (rtcState.role !== 'callee') {
    const error = new Error(`${operation} forbidden for role: ${rtcState.role}`);
    logRtc(operation, 403, { reason: 'role-guard-callee' });
    throw error;
  }
}

// Safe fetch with abort signal and telemetry
async function safeFetch(url: string, options: RequestInit = {}, operation: string) {
  const signal = rtcState.ac?.signal;
  const response = await fetch(url, { ...options, signal });
  logRtc(operation, response.status);
  
  if (!response.ok && response.status === 403) {
    throw new Error(`403 ${operation}: wrong role access`);
  }
  
  return response;
}

// Caller flow: createOffer → POST /offer → poll GET /answer → ICE
async function callerFlow(pc: RTCPeerConnection) {
  guardCallerOnly('caller-flow');
  
  // Create and set local offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  
  // POST offer
  await safeFetch("/api/rtc/offer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairId: rtcState.pairId, sdp: JSON.stringify(offer) }),
  }, 'post-offer');

  // Poll for answer
  while (!rtcState.ac?.signal.aborted) {
    try {
      const response = await safeFetch(
        `/api/rtc/answer?pairId=${encodeURIComponent(String(rtcState.pairId))}`,
        { cache: "no-store" },
        'poll-answer'
      );
      
      if (response.status === 200) {
        const { sdp } = await response.json().catch(() => ({}));
        if (sdp) {
          await pc.setRemoteDescription(JSON.parse(sdp));
          logRtc('answer-received', 200);
          break;
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') break;
      logRtc('poll-answer-error', 500, { error: e.message });
    }
    
    await new Promise(res => setTimeout(res, 300 + Math.floor(Math.random() * 400)));
  }
}

// Callee flow: poll GET /offer → createAnswer → POST /answer → ICE
async function calleeFlow(pc: RTCPeerConnection) {
  guardCalleeOnly('callee-flow');
  
  // Poll for offer
  while (!rtcState.ac?.signal.aborted) {
    try {
      const response = await safeFetch(
        `/api/rtc/offer?pairId=${encodeURIComponent(String(rtcState.pairId))}`,
        { cache: "no-store" },
        'poll-offer'
      );
      
      if (response.status === 200) {
        const { sdp } = await response.json().catch(() => ({}));
        if (sdp) {
          await pc.setRemoteDescription(JSON.parse(sdp));
          
          // Create and set local answer
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          // POST answer
          await safeFetch("/api/rtc/answer", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pairId: rtcState.pairId, sdp: JSON.stringify(answer) }),
          }, 'post-answer');
          
          logRtc('offer-answered', 200);
          break;
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') break;
      logRtc('poll-offer-error', 500, { error: e.message });
    }
    
    await new Promise(res => setTimeout(res, 300 + Math.floor(Math.random() * 400)));
  }
}

// ICE candidate exchange for both roles
async function iceExchange(pc: RTCPeerConnection) {
  // POST ICE candidates when generated
  pc.onicecandidate = async (e) => {
    if (!e.candidate || rtcState.ac?.signal.aborted) return;
    
    try {
      await safeFetch("/api/rtc/ice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pairId: rtcState.pairId, candidate: e.candidate }),
      }, 'post-ice');
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        logRtc('post-ice-error', 500, { error: e.message });
      }
    }
  };

  // Poll for remote ICE candidates
  const pollIce = async () => {
    while (!rtcState.ac?.signal.aborted) {
      try {
        const response = await safeFetch(
          `/api/rtc/ice?pairId=${encodeURIComponent(String(rtcState.pairId))}`,
          { cache: "no-store" },
          'poll-ice'
        );
        
        if (response.status === 200) {
          const candidates = await response.json().catch(() => []);
          
          // Support both array format [{cand}] and single object format {candidate}
          const candidateArray = Array.isArray(candidates) ? candidates : [candidates];
          
          for (const item of candidateArray) {
            if (!item) continue;
            
            try {
              // Handle both {cand} and {candidate} formats
              const candidate = item.cand || item.candidate;
              if (candidate) {
                await pc.addIceCandidate(candidate);
                logRtc('ice-added', 200);
              }
            } catch (e) {
              logRtc('ice-add-error', 500, { error: e });
            }
          }
        }
      } catch (e: any) {
        if (e.name === 'AbortError') break;
        logRtc('poll-ice-error', 500, { error: e.message });
      }
      
      await new Promise(res => setTimeout(res, 350 + Math.floor(Math.random() * 350)));
    }
  };

  // Start ICE polling
  pollIce().catch(() => {});
}

// Main RTC flow with state machine
export async function startRtcFlow() {
  try {
    // Cleanup any previous session
    cleanup();
    
    // Create new AbortController
    rtcState.ac = new AbortController();
    
    logRtc('flow-start', 200);

    // 0) Initialize anon cookie
    await fetch("/api/anon/init", { 
      method: "GET", 
      cache: "no-store",
      signal: rtcState.ac.signal 
    }).catch(() => {});

    // 1) Enqueue with filters (single enqueue point)
    const ls = (k: string) => (typeof window !== "undefined" && window.localStorage) ? window.localStorage.getItem(k) : null;
    const anonId = (typeof window !== "undefined") ? (window.localStorage.getItem("ditona_anon") || "") : "";
    const myGender = ls("ditona_myGender") || ls("ditona:filters:genders") || "all";
    const geoRaw = ls("ditona_geo") || ls("ditona_geo_hint");
    let geo: any = null;
    try { 
      geo = geoRaw ? JSON.parse(geoRaw) : null; 
    } catch { 
      geo = null; 
    }
    const country = geo?.country || "";
    const city = geo?.city || "";

    await safeFetch("/api/rtc/enqueue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anonId, gender: myGender, geo: { country, city } }),
    }, 'enqueue');

    // 2) Matchmake: support both response formats
    let matchResult: any = null;
    for (let i = 0; i < 50 && !rtcState.ac.signal.aborted; i++) {
      const response = await safeFetch("/api/rtc/matchmake", { 
        method: "POST", 
        cache: "no-store" 
      }, 'matchmake');
      
      if (response.status === 200) {
        const j = await response.json().catch(() => ({}));
        
        // Support both formats: {pairId, role} and {found:true, pairId, role}
        if (j?.pairId && j?.role) {
          matchResult = j;
          rtcState.pairId = j.pairId;
          rtcState.role = j.role;
          
          // Store in localStorage for recovery
          if (typeof window !== "undefined") {
            window.localStorage.setItem("ditona_pair", j.pairId);
            window.localStorage.setItem("ditona_role", j.role);
          }
          
          // Handle peer metadata
          try {
            if (j?.peerMeta && typeof window !== "undefined") {
              window.localStorage.setItem("ditona:peer:meta", JSON.stringify(j.peerMeta));
              window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: j.peerMeta }));
            }
          } catch {}
          
          logRtc('match-found', 200, { role: rtcState.role });
          break;
        }
      }
      
      await new Promise(res => setTimeout(res, 300 + Math.floor(Math.random() * 500)));
    }
    
    if (!rtcState.pairId || !rtcState.role) {
      throw new Error("matchmake-timeout");
    }

    // 3) Get ICE servers and create RTCPeerConnection
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const iceResponse = await safeFetch("/api/turn", { cache: "no-store" }, 'get-ice-servers');
      if (iceResponse.ok) {
        const iceData = await iceResponse.json().catch(() => ({}));
        if (iceData.iceServers && Array.isArray(iceData.iceServers)) {
          iceServers = iceData.iceServers;
          logRtc('ice-servers-loaded', 200, { count: iceServers.length });
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        logRtc('ice-servers-fallback', 500, { error: e.message });
      }
    }
    
    const pc = new RTCPeerConnection({ iceServers });
    rtcState.pc = pc;
    
    // Setup remote video
    const remote = document.getElementById("remoteVideo") as HTMLVideoElement | null;
    pc.ontrack = (ev) => {
      const stream = ev.streams?.[0] || new MediaStream([ev.track]);
      if (remote) {
        remote.srcObject = stream;
        remote.muted = true;
        remote.playsInline = true;
        remote.autoplay = true as any;
        remote.play?.().catch(() => {});
      }
      logRtc('track-received', 200);
    };
    
    // Add local tracks if available
    const localStream = getLocalStream();
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      logRtc('local-tracks-added', 200, { trackCount: localStream.getTracks().length });
    } else {
      logRtc('no-local-stream', 204);
    }

    // 4) Start ICE exchange (for both roles)
    iceExchange(pc);

    // 5) Role-specific SDP exchange
    if (rtcState.role === "caller") {
      await callerFlow(pc);
    } else {
      await calleeFlow(pc);
    }

    // Store PC reference for cleanup and debug access
    (pc as any).__ditonaCleanup = () => cleanup();
    if (typeof window !== "undefined") {
      (window as any).ditonaPC = pc;
    }
    
    logRtc('flow-complete', 200, { role: rtcState.role });
    return pc;
    
  } catch (e: any) {
    if (e.name === 'AbortError') {
      logRtc('flow-aborted', 499);
    } else {
      logRtc('flow-error', 500, { error: e.message });
      console.warn("RTC flow error", e);
    }
    cleanup();
    throw e;
  }
}

// Legacy compatibility and once-guard functionality
let __rtcOnceFlag = false;

export function stopRtcSession(reason: string = "user") {
  logRtc('session-stop', 200, { reason });
  cleanup();
}

export async function startRtcFlowOnce() {
  if (__rtcOnceFlag) {
    logRtc('flow-once-blocked', 429);
    return;
  }
  
  __rtcOnceFlag = true;
  try {
    stopRtcSession("restart");
    return await startRtcFlow();
  } finally {
    __rtcOnceFlag = false;
  }
}