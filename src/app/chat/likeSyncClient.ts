"use client";

import { busOn, busEmit } from "../../utils/bus";

let pairId: string | null = null;
let timer: any = null;
let intervalVisible=2000; let intervalHidden=8000;
function adjustTimer(){ try{ const iv=(typeof document!=="undefined" && document.hidden)?intervalHidden:intervalVisible; if (timer) clearInterval(timer); timer=setInterval(pull, iv); }catch(e){} }

let you = false;
let count = 0;

async function pull() {
  if (!pairId) return;
  try {
    const r = await fetch(`/api/like?pairId=${encodeURIComponent(pairId)}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!r.ok) return;
    const j = await r.json();
    count = Number(j?.count ?? 0);
    you = !!j?.you;
    busEmit("like:update", { pairId, count, you });
  } catch {}
}

async function toggle() {
  if (!pairId) return;
  const wantInc = !you;
  // تفاؤلي
  you = wantInc;
  count = Math.max(0, count + (wantInc ? 1 : -1));
  busEmit("like:update", { pairId, count, you });

  try {
    const r = await fetch(
      `/api/like?pairId=${encodeURIComponent(pairId)}&op=${wantInc ? "inc" : "dec"}`,
      { method: "POST", credentials: "include", cache: "no-store" }
    );
    // بعد الاستجابة، نسحب الحقيقة
    setTimeout(pull, 100);
  } catch {
    // في حال الفشل، استرجع من الخادم
    setTimeout(pull, 200);
  }
}

// ربط أحداث الـRTC والـUI
const off1 = busOn("rtc:pair", (e: any) => {
  try { pairId = e?.pairId || e?.id || null; } catch { pairId = null; }
  if (timer) clearInterval(timer);
  pull();
  timer = adjustTimer();
});
const off2 = busOn("rtc:end", () => { if (timer) clearInterval(timer); timer = null; pairId = null; });
const off3 = busOn("rtc:closed", () => { if (timer) clearInterval(timer); timer = null; pairId = null; });
const off4 = busOn("ui:like", () => { void toggle(); });

// تنظيف عند المغادرة
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { if (timer) clearInterval(timer); });
}

if (typeof document!=="undefined"){ document.addEventListener("visibilitychange", ()=>{ try{ if (timer) adjustTimer(); }catch(e){} }); }
