/* Minimal RTC client flow: enqueue → offer/answer → ice */
export async function startRtcFlow() {
  try {
    const enq = await fetch("/api/rtc/enqueue", { method: "POST" });
    if (!enq.ok) throw new Error("enqueue failed");
    const { pairId, role, anonId } = await enq.json();

    const pc = new RTCPeerConnection();
    // ربط الفيديو إن وجد
    const remote = document.getElementById("remoteVideo") as HTMLVideoElement | null;
    pc.ontrack = (ev) => {
      const s = ev.streams?.[0] || new MediaStream([ev.track]);
      if (remote) { remote.srcObject = s; remote.muted = true; remote.playsInline = true; remote.play().catch(()=>{}); }
    };
    // أضف المسارات المحليّة إن وُجدت
    const local = (window as any).__localStream as MediaStream | undefined;
    if (local) local.getTracks().forEach(t => pc.addTrack(t, local));

    // إرسال ICE للخارج
    pc.onicecandidate = async (e) => {
      if (!e.candidate) return;
      await fetch("/api/rtc/ice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pairId, anonId, candidate: e.candidate })
      }).catch(()=>{});
    };

    async function poll(path: string) {
      const u = new URL(path, location.origin);
      u.searchParams.set("pairId", pairId);
      u.searchParams.set("anonId", anonId);
      const r = await fetch(u.toString());
      if (r.ok) return r.json();
      return null;
    }

    if (role === "caller") {
      const off = await pc.createOffer();
      await pc.setLocalDescription(off);
      await fetch("/api/rtc/offer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ pairId, anonId, role: "caller", sdp: off })
      });
      // انتظر الإجابة
      for (let i=0;i<40;i++) {
        const ans = await poll("/api/rtc/answer");
        if (ans?.ready && ans?.sdp) { await pc.setRemoteDescription(ans.sdp); break; }
        await new Promise(r=>setTimeout(r,700));
      }
    } else {
      // callee: انتظر العرض
      for (let i=0;i<40;i++) {
        const off = await poll("/api/rtc/offer");
        if (off?.ready && off?.sdp) {
          await pc.setRemoteDescription(off.sdp);
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          await fetch("/api/rtc/answer", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ pairId, anonId, role: "callee", sdp: ans })
          });
          break;
        }
        await new Promise(r=>setTimeout(r,700));
      }
    }

    // سحب ICE الواردة
    (async function pullIce(){
      for (let i=0;i<120;i++) {
        const u = new URL("/api/rtc/ice", location.origin);
        u.searchParams.set("pairId", pairId);
        u.searchParams.set("anonId", anonId);
        const r = await fetch(u.toString());
        if (r.ok) {
          const j = await r.json();
          if (j?.candidate) {
            try { await pc.addIceCandidate(j.candidate); } catch {}
          }
        }
        await new Promise(r=>setTimeout(r,700));
      }
    })();
  } catch (e) {
    console.warn("RTC flow error", e);
  }
}