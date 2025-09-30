set -euo pipefail
ts="$(date +%Y%m%d-%H%M%S)"
report="_ops/reports/rtc_ui_bridge_${ts}.txt"
mkdir -p _ops/reports

echo "-- Prep --" | tee "$report"
test -f src/app/chat/ChatClient.tsx || { echo "ChatClient.tsx missing"; exit 1; }

# 1) أوقف مسار المطابقة القديم داخل doMatch
if grep -q "/api/match/next" src/app/chat/ChatClient.tsx; then
  perl -0777 -pe 's/(function\s+doMatch\s*\([^)]*\)\s*{|\bconst\s+doMatch\s*=\s*async\s*\([^)]*\)\s*=>\s*{)/$1\n  // RTC bridge: disable legacy matcher\n  return;\n/ if $. == 0' \
    -i src/app/chat/ChatClient.tsx
fi

# 2) استبدل استدعاءات doMatch بـ startRtcFlow في مستمعي next/prev
perl -0777 -pe 's/doMatch\s*\((?:true|false)?\)\s*;?/startRtcFlow();/g' -i src/app/chat/ChatClient.tsx

# 3) أضف استيراد startRtcFlow إن لم يوجد، وأنشئ الملف المساعد إن لم يكن موجودًا
if ! grep -q "startRtcFlow" src/app/chat/ChatClient.tsx; then
  # أدخل الاستيراد بعد أول سطر import
  perl -0777 -pe 's/^(import .*\n)/$1import { startRtcFlow } from ".\/rtcFlow";\n/s' -i src/app/chat/ChatClient.tsx
fi

mkdir -p src/app/chat
if [ ! -f src/app/chat/rtcFlow.ts ]; then
  cat > src/app/chat/rtcFlow.ts <<'TS'
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
        body: JSON.stringify({ pairId, anonId, dir: "out", candidate: e.candidate })
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
        body: JSON.stringify({ pairId, anonId, sdp: off.sdp })
      });
      // انتظر الإجابة
      for (let i=0;i<40;i++) {
        const ans = await poll("/api/rtc/answer");
        if (ans?.sdp) { await pc.setRemoteDescription({ type:"answer", sdp: ans.sdp }); break; }
        await new Promise(r=>setTimeout(r,700));
      }
    } else {
      // callee: انتظر العرض
      for (let i=0;i<40;i++) {
        const off = await poll("/api/rtc/offer");
        if (off?.sdp) {
          await pc.setRemoteDescription({ type:"offer", sdp: off.sdp });
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          await fetch("/api/rtc/answer", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ pairId, anonId, sdp: ans.sdp })
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
        u.searchParams.set("dir", "in");
        const r = await fetch(u.toString());
        if (r.ok) {
          const j = await r.json();
          for (const c of j?.candidates || []) {
            try { await pc.addIceCandidate(c); } catch {}
          }
        }
        await new Promise(r=>setTimeout(r,700));
      }
    })();
  } catch (e) {
    console.warn("RTC flow error", e);
  }
}
TS
fi

# 4) بناء سريع وفحص ثابت
echo "-- Build --" | tee -a "$report"
pnpm -s build | tee -a "$report"

echo "-- Acceptance --" | tee -a "$report"
echo -n "LEGACY_MATCH_CALLS=" | tee -a "$report"; grep -R "/api/match/next" -n src/app/chat/ChatClient.tsx | wc -l | tee -a "$report"
echo -n "HAS_startRtcFlow=" | tee -a "$report"; grep -q "startRtcFlow" src/app/chat/ChatClient.tsx && echo 1 | tee -a "$report" || echo 0 | tee -a "$report"
echo "REPORT=$report" | tee -a "$report"
echo "-- End Acceptance --" | tee -a "$report"

echo "Saved: $report"
