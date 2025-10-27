"use client";

import { useEffect, useRef } from "react";
import { emit } from "@/utils/events";

function stableDid(): string {
  try {
    const k = "ditona_did";
    const v = localStorage.getItem(k);
    if (v) return v;
    const gen = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(k, gen);
    return gen;
  } catch {
    return "did-" + Math.random().toString(36).slice(2, 9);
  }
}

async function fetchCountByDid(did: string) {
  const tryKeys = ["did", "targetDid"] as const; // دعم كلا الاسمين حسب عقد الخادم
  for (const key of tryKeys) {
    try {
      const r = await fetch(`/api/like?${key}=${encodeURIComponent(did)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!r.ok) continue;
      const j = await r.json().catch(() => ({} as any));
      const count = Number(j?.count ?? j?.likes ?? 0);
      const mine = Boolean(j?.mine ?? j?.you ?? false);
      // بث موحّد تستهلكه PeerOverlay
      emit("like:sync", { count, likedByMe: mine });
      return true;
    } catch {}
  }
  return false;
}

export default function LikeSystem() {
  const peerDidRef = useRef<string>("");
  const pollRef = useRef<number | null>(null);

  // التعرّف على DID للطرف وتحديثه من الميتا
  useEffect(() => {
    const setDid = (d?: any) => {
      const did =
        d?.did || d?.peerDid || d?.id || d?.identity ||
        (globalThis as any).__ditonaPeerDid || (globalThis as any).__peerDid || "";
      if (did && did !== peerDidRef.current) {
        peerDidRef.current = String(did);
        fetchCountByDid(peerDidRef.current);
      }
    };

    const onMeta = (e: any) => setDid(e?.detail);
    window.addEventListener("ditona:peer-meta", onMeta as any);
    window.addEventListener("rtc:peer-meta", onMeta as any);

    const onPair = () => {
      // زوج جديد: امسح العداد مؤقتًا ريثما تصل الميتا
      emit("like:sync", { count: 0 });
      // جرّب الالتقاط من المتغيرات العالمية فورًا
      setTimeout(() => setDid(), 150);
    };
    window.addEventListener("rtc:pair", onPair as any);

    const onPhase = (e: any) => {
      const ph = e?.detail?.phase;
      if (ph === "searching" || ph === "stopped" || ph === "matched") {
        emit("like:sync", { count: 0 });
      }
    };
    window.addEventListener("rtc:phase", onPhase as any);

    // مؤقّت polling خفيف بالـdid فقط
    pollRef.current = window.setInterval(() => {
      const did = peerDidRef.current;
      if (did) fetchCountByDid(did);
    }, 4000);

    return () => {
      window.removeEventListener("ditona:peer-meta", onMeta as any);
      window.removeEventListener("rtc:peer-meta", onMeta as any);
      window.removeEventListener("rtc:pair", onPair as any);
      window.removeEventListener("rtc:phase", onPhase as any);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // دعم إرسال اللايك من شريط الأدوات عبر ChatClient فقط. لا UI هنا.
  // ملاحظة: ChatClient هو المسؤول عن:
  //  - نشر {t:"like"} على الـDC
  //  - POST /api/like مع headers:{ "x-did": stableDid() } و body:{ targetDid, liked }
  //  - بث like:sync بعد النجاح أو التراجع بعد الفشل

  return null;
}
