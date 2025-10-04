// Client-only helper for Perfect Negotiation pattern.
type Signal = {
  send: (m: any) => void;
  on: (t: string, cb: (m: any) => void) => void;
  off?: (t: string, cb: (m: any) => void) => void;
};

export function setupPerfectNegotiation(
  pc: RTCPeerConnection,
  signal: Signal,
  opts: { polite?: boolean; onStable?: () => void } = {}
) {
  const polite = opts.polite ?? true;
  let makingOffer = false;
  let negotiationInProgress = false;

  pc.onnegotiationneeded = async () => {
    if (makingOffer || negotiationInProgress) return;
    negotiationInProgress = true;
    makingOffer = true;
    try {
      await pc.setLocalDescription();
      signal.send({ t: "offer", sdp: pc.localDescription });
    } catch {}
    makingOffer = false;
    negotiationInProgress = false;
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate) signal.send({ t: "ice", candidate: ev.candidate });
  };

  const onSignal = async (msg: any) => {
    try {
      if (msg?.t === "offer") {
        const offer = new RTCSessionDescription(msg.sdp);
        const collision = pc.signalingState !== "stable";
        if (collision) {
          if (!polite) return;
          await pc.setLocalDescription({ type: "rollback" } as any);
        }
        await pc.setRemoteDescription(offer);
        await pc.setLocalDescription();
        signal.send({ t: "answer", sdp: pc.localDescription });
      } else if (msg?.t === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } else if (msg?.t === "ice" && msg.candidate) {
        try { await pc.addIceCandidate(msg.candidate); } catch {}
      }
    } catch {}
  };

  signal.on("signal", onSignal);

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected" && opts.onStable) opts.onStable();
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      // leave policy to caller; typical: trigger auto-next after ~1200ms
    }
  };

  return {
    teardown() {
      if (signal.off) signal.off("signal", onSignal);
      try { pc.onnegotiationneeded = null as any; } catch {}
      try { pc.onicecandidate = null as any; } catch {}
      try { pc.onconnectionstatechange = null as any; } catch {}
    }
  };
}
