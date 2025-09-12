/* Minimal RTC client flow: enqueue -> matchmake -> offer/answer -> ice (REST only) */
import { withFiltersBody } from "./filtersBridge";

export async function startRtcFlow() {
  try {
    // 0) تهيئة كوكي anon الموقّع (إن لم يوجد)
    await fetch("/api/anon/init", { method: "GET", cache: "no-store" }).catch(() => {});

    // 1) Enqueue (سمات + فلاتر). الواجهة يمكنها تمرير جسم اختياري:
    const baseBody = (window as any).__ditonaEnqueueBody || {};
    const body = withFiltersBody(baseBody);
    await fetch("/api/rtc/enqueue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    // 2) Matchmake: 204 → backoff 300–800ms؛ 200 → {pairId, role}
    let pairId: string | undefined;
    let role: "caller" | "callee" | undefined;
    for (let i = 0; i < 50; i++) {
      const r = await fetch("/api/rtc/matchmake", { method: "POST", cache: "no-store" });
      if (r.status === 200) {
        const j = await r.json().catch(() => ({}));
        pairId = j?.pairId; role = j?.role;
        if (pairId && role) break;
      }
      await new Promise(res => setTimeout(res, 300 + Math.floor(Math.random() * 500)));
    }
    if (!pairId || !role) throw new Error("matchmake-timeout");

    // 3) إنشاء RTCPeerConnection
    const pc = new RTCPeerConnection();
    const remote = document.getElementById("remoteVideo") as HTMLVideoElement | null;
    pc.ontrack = (ev) => {
      const s = ev.streams?.[0] || new MediaStream([ev.track]);
      if (remote) {
        remote.srcObject = s;
        remote.muted = true;
        remote.playsInline = true;
        remote.autoplay = true as any;
        remote.play?.().catch(() => {});
      }
    };
    // إضافة المسارات المحلية إن وُجدت
    const local: MediaStream | undefined = (window as any).__localStream;
    if (local) local.getTracks().forEach(t => pc.addTrack(t, local));

    // 4) ICE: POST إلى /api/rtc/ice + Poll GET
    pc.onicecandidate = async (e) => {
      if (!e.candidate) return;
      try {
        await fetch("/api/rtc/ice", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pairId, candidate: e.candidate }),
        });
      } catch {}
    };
    const pollIce = async () => {
      try {
        const r = await fetch(`/api/rtc/ice?pairId=${encodeURIComponent(String(pairId))}`, { cache: "no-store" });
        if (r.status === 200) {
          const arr = await r.json().catch(() => []);
          for (const it of arr) {
            try { await pc.addIceCandidate(it.cand); } catch {}
          }
        }
      } catch {}
    };
    const iceTimer = setInterval(pollIce, 350 + Math.floor(Math.random() * 350));

    // 5) تبادل SDP via REST
    if (role === "caller") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch("/api/rtc/offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pairId, sdp: JSON.stringify(offer) }),
      });
      // Poll answer
      for (;;) {
        const g = await fetch(`/api/rtc/answer?pairId=${encodeURIComponent(String(pairId))}`, { cache: "no-store" });
        if (g.status === 200) {
          const { sdp } = await g.json().catch(() => ({}));
          if (sdp) { await pc.setRemoteDescription(JSON.parse(sdp)); break; }
        }
        await new Promise(res => setTimeout(res, 300 + Math.floor(Math.random() * 400)));
      }
    } else {
      // callee: poll offer → create answer → POST answer
      for (;;) {
        const g = await fetch(`/api/rtc/offer?pairId=${encodeURIComponent(String(pairId))}`, { cache: "no-store" });
        if (g.status === 200) {
          const { sdp } = await g.json().catch(() => ({}));
          if (sdp) {
            await pc.setRemoteDescription(JSON.parse(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await fetch("/api/rtc/answer", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ pairId, sdp: JSON.stringify(answer) }),
            });
            break;
          }
        }
        await new Promise(res => setTimeout(res, 300 + Math.floor(Math.random() * 400)));
      }
    }

    // إتاحة تنظيف المؤقت عند الإنهاء
    (pc as any).__ditonaCleanup = () => clearInterval(iceTimer);
  } catch (e) {
    console.warn("RTC flow error", e);
  }
}
/** ------------------------------------------------------------------------
 * Once-guard: يمنع إطلاق تدفّق RTC مرتين في آنٍ واحد (double-start).
 * Guards + cleanup for RTC sessions.
 * ---------------------------------------------------------------------- */
let __rtcOnceFlag = false;
let __abortCtrl: AbortController | null = null;
let __pcCur: RTCPeerConnection | null = null;
let __localCur: MediaStream | null = null;

export function stopRtcSession(reason: string = "user") {
  try { __abortCtrl?.abort(); } catch {}
  __abortCtrl = null;
  try { if (__pcCur) { try { __pcCur.getSenders?.().forEach(s=>{try{s.track&&s.track.stop()}catch{}}) } catch {} try { __pcCur.close() } catch {} } } catch {}
  __pcCur = null;
  try { __localCur?.getTracks?.().forEach(t=>{try{t.stop()}catch{}}) } catch {}
  __localCur = null;
}

export function attachPeer(pc?: RTCPeerConnection, local?: MediaStream, abortCtrl?: AbortController) {
  if (pc) __pcCur = pc;
  if (local) __localCur = local;
  if (abortCtrl) __abortCtrl = abortCtrl;
}

export async function startRtcFlowOnce() {
  if (__rtcOnceFlag) return;
  __rtcOnceFlag = true;
  try {
    stopRtcSession("restart");
    // نفترض وجود startRtcFlow الأصلي في نفس الملف (كما هو معمَّم في المشروع)
    // إن كان اسمه مختلفًا لديك، استبدله هنا بنفس الاسم.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    // @ts-ignore
    return await startRtcFlow();
  } finally {
    __rtcOnceFlag = false;
  }
}
