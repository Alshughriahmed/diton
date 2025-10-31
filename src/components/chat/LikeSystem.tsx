// src/components/chat/LikeSystem.tsx
"use client";
import { useEffect, useRef } from "react";

type LikeState = { you: boolean; count: number };

function curPair(): string | null {
  try { const w:any = globalThis as any; return w.__ditonaPairId || w.__pairId || null; }
  catch { return null; }
}
function meDid(): string {
  try {
    let d = localStorage.getItem("ditona_did");
    if (!d) { d = crypto.randomUUID(); localStorage.setItem("ditona_did", d); }
    return d;
  } catch { return "anon"; }
}
// بدائل للحصول على DID للطرف
function guessPeerDid(): string | null {
  try {
    const w:any = globalThis as any;
    // المصدر الأساسي
    if (w.__ditonaPeerDid || w.__peerDid) return w.__ditonaPeerDid || w.__peerDid;
    // من LiveKit identity
    const r = w.__lkRoom;
    if (r && r.remoteParticipants && typeof r.remoteParticipants.values === "function") {
      const it = r.remoteParticipants.values();
      const first = it.next().value;
      if (first?.identity && typeof first.identity === "string") return first.identity;
    }
  } catch {}
  return null;
}

async function postLike(targetDid: string, liked: boolean) {
  // liked هنا بوليني صريح
  const body = JSON.stringify({ targetDid, liked: liked === true });
  const r = await fetch("/api/like", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-did": meDid() },
    body
  });
  if (!r.ok) throw new Error(`like ${r.status}`);
  return r.json() as Promise<{ count: number; you: boolean }>;
}

function publishDC(detail: any) {
  try {
    const w:any = globalThis as any;
    const room = w.__lkRoom;
    if (!room) return;
    const payload = new TextEncoder().encode(JSON.stringify(detail));
    room.localParticipant?.publishData(payload, { reliable: true, topic: "like" });
  } catch {}
}

export default function LikeSystem() {
  useEffect(() => {
    let st: LikeState = { you: false, count: 0 };
    const inflight = { v: false };
    const pairRef = { v: curPair() };

    const onSync = (e: any) => {
      const d = e?.detail || {};
      const pidNow = curPair();
      const pidEvt = d?.pairId || pidNow;
      if (pidEvt && pidNow && pidEvt !== pidNow) return;
      if (typeof d.count === "number") st.count = d.count;
      if (typeof d.liked === "boolean") st.you = d.liked;
      pairRef.v = pidNow;
    };

    const onPair = () => { st = { you: false, count: 0 }; pairRef.v = curPair(); inflight.v = false; };

    const onToggle = async () => {
      if (inflight.v) { navigator.vibrate?.(8); return; }

      const pid = curPair();
      const tDid = guessPeerDid();
      if (!pid || !tDid) { navigator.vibrate?.(8); return; }

      // احسب الحالة التالية كبوليني صريح
      const nextLiked: boolean = st.you === true ? false : true;

      // وميض للطرف الآخر فورًا
      publishDC({ t: "like", liked: nextLiked, pairId: pid });

      // تفاؤل محلي مضبوط
      const optimisticCount = Math.max(0, (st.count || 0) + (nextLiked ? 1 : -1));
      window.dispatchEvent(new CustomEvent("like:sync", {
        detail: { pairId: pid, count: optimisticCount, liked: nextLiked }
      }));

      inflight.v = true;
      try {
        const r = await postLike(tDid, nextLiked); // {count, you}
        // بث موحّد بعد نجاح POST
        const finalLiked = !!r.you;
        const finalCount = Number(r.count) || 0;
        const detail = { pairId: pid, count: finalCount, liked: finalLiked };
        window.dispatchEvent(new CustomEvent("like:sync", { detail }));
        publishDC({ t: "like:sync", pairId: pid, count: finalCount, liked: finalLiked });
        st.you = finalLiked; st.count = finalCount;
        navigator.vibrate?.(16);
      } catch (_e) {
        // تراجع التفاؤل
        window.dispatchEvent(new CustomEvent("like:sync", {
          detail: { pairId: pid, count: st.count, liked: st.you }
        }));
      } finally {
        inflight.v = false;
      }
    };

    window.addEventListener("like:sync", onSync as any, { passive: true } as any);
    window.addEventListener("rtc:pair", onPair as any, { passive: true } as any);
    window.addEventListener("ui:like:toggle", onToggle as any);

    return () => {
      window.removeEventListener("like:sync", onSync as any);
      window.removeEventListener("rtc:pair", onPair as any);
      window.removeEventListener("ui:like:toggle", onToggle as any);
    };
  }, []);

  return null;
}
