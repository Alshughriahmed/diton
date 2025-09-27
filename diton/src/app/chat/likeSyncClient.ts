"use client";

import { on, emit } from "@/utils/events";
import { safeFetch } from "@/app/chat/safeFetch";

let pairId: string | null = null;
let timer: any = null;
let intervalVisible=2000; let intervalHidden=8000;
function adjustTimer(){ try{ const iv=(typeof document!=="undefined" && document.hidden)?intervalHidden:intervalVisible; if (timer) clearInterval(timer); timer=setInterval(pull, iv); }catch(e){} }

let you = false;
let count = 0;

async function pull() {
  if (!pairId) return;
  try {
    const r = await safeFetch(`/api/like?pairId=${encodeURIComponent(pairId)}`, {
  method: "GET",
  cache: "no-cache",
});

    if (!r.ok) return;
    const j = await r.json();
    count = Number(j?.count ?? 0);
    you = !!j?.you;
    emit("ui:likeUpdate" as any, { pairId, count, you });
  } catch {}
}

async function toggle() {
  if (!pairId) return;
  const wantInc = !you;
  // تفاؤلي
  you = wantInc;
  count = Math.max(0, count + (wantInc ? 1 : -1));
  emit("ui:likeUpdate" as any, { pairId, count, you });

  try {
    await safeFetch(
  `/api/like?pairId=${encodeURIComponent(pairId)}&op=${wantInc ? "inc" : "dec"}`,
  { method: "POST", headers: { "content-type": "application/json" } }
);

    // بعد الاستجابة، نسحب الحقيقة
    setTimeout(pull, 100);
  } catch {
    // في حال الفشل، استرجع من الخادم
    setTimeout(pull, 200);
  }
}

// ربط أحداث الـRTC والـUI
const off1 = on("rtc:pair" as any, (e: any) => {
  try { pairId = e?.pairId || e?.id || null; } catch { pairId = null; }
  if (timer) clearInterval(timer);
  pull();
  timer = adjustTimer();
});
const off2 = on("rtc:end" as any, () => { if (timer) clearInterval(timer); timer = null; pairId = null; });
const off3 = on("rtc:closed" as any, () => { if (timer) clearInterval(timer); timer = null; pairId = null; });
const off4 = on("ui:like" as any, () => { void toggle(); });

// تنظيف عند المغادرة
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { if (timer) clearInterval(timer); });
}

if (typeof document!=="undefined"){ document.addEventListener("visibilitychange", ()=>{ try{ if (timer) adjustTimer(); }catch(e){} }); }
