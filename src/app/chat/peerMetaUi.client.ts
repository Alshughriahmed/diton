// src/app/chat/peerMetaUi.client.ts
"use client";

import { normalizeGender, genderSymbol } from "@/lib/gender";

type Meta = Partial<{ displayName:string; gender:unknown; country:string; city:string; avatarUrl:string; likes:number; vip:boolean; did?:string }>;

const $ = (s: string) => document.querySelector<HTMLElement>(s);
const el = {
  avatar: () => $('[data-ui="peer-avatar"]') as HTMLImageElement | null,
  name: () => $('[data-ui="peer-name"]'),
  vip: () => $('[data-ui="peer-vip"]'),
  likes: () => $('[data-ui="peer-likes"]'),
  country: () => $('[data-ui="peer-country"]'),
  city: () => $('[data-ui="peer-city"]'),
  gender: () => $('[data-ui="peer-gender"]'),
  heartsHost: () => $('[data-ui="like-hearts"]'),
};

function clearHUD() {
  el.name()?.replaceChildren();
  const a = el.avatar(); if (a) { a.src = ""; a.classList.add("hidden"); }
  if (el.vip()) el.vip()!.textContent = "";
  if (el.likes()) el.likes()!.textContent = "";
  if (el.country()) el.country()!.textContent = "—";
  if (el.city()) el.city()!.textContent = "";
  if (el.gender()) el.gender()!.textContent = "";
}

function classForGender(n: "m"|"f"|"c"|"l"|"u") {
  // tailwind ألوان جاهزة
  if (n === "m") return "text-blue-400";
  if (n === "f") return "text-red-500";
  if (n === "c") return "text-rose-500";
  if (n === "l") return ""; // الإيموجي ملون
  return "text-white/80";
}

function applyMeta(meta: Meta) {
  try {
    (window as any).__ditonaLastPeerMeta = meta;
    sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(meta));
  } catch {}

  if (meta.displayName) el.name()?.replaceChildren(document.createTextNode(meta.displayName));

  const a = el.avatar();
  if (a) {
    if (meta.avatarUrl) { a.src = String(meta.avatarUrl); a.classList.remove("hidden"); }
    else { a.src = ""; a.classList.add("hidden"); }
  }

  if (el.vip()) el.vip()!.textContent = meta.vip ? "👑" : "🚫👑";
  if (typeof meta.likes === "number" && el.likes()) el.likes()!.textContent = String(meta.likes);

  if (meta.country && el.country()) el.country()!.textContent = String(meta.country).toUpperCase();
  if (meta.city && el.city()) el.city()!.textContent = meta.city;

  const g = normalizeGender(meta.gender);
  const sym = genderSymbol(g) || "";
  const gEl = el.gender();
  if (gEl) {
    gEl.textContent = sym;
    gEl.classList.remove("text-blue-400","text-red-500","text-rose-500","text-white/80");
    const cc = classForGender(g);
    if (cc) gEl.classList.add(cc);
  }

  // خزّن did لاستخدام like
  const did = meta.did || (meta as any).deviceId || (meta as any).peerDid || (meta as any).id || (meta as any).identity;
  if (did) { (window as any).__ditonaPeerDid = did; (window as any).__peerDid = did; }
}

// Hearts effect
function burstHearts(n = 4) {
  const host = el.heartsHost();
  if (!host) return;
  for (let i = 0; i < n; i++) {
    const span = document.createElement("span");
    span.textContent = "💗";
    span.style.position = "absolute";
    span.style.left = `${50 + (Math.random() * 24 - 12)}%`;
    span.style.bottom = "8%";
    span.style.opacity = "0.92";
    span.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,.5))";
    span.style.transition = "transform 900ms ease, opacity 900ms ease";
    host.appendChild(span);
    requestAnimationFrame(() => {
      span.style.transform = `translateY(-120px) scale(${0.9 + Math.random() * 0.6})`;
      span.style.opacity = "0";
    });
    setTimeout(() => { try { host.removeChild(span); } catch {} }, 980);
  }
}

function samePair(pid?: string | null): boolean {
  const cur = (window as any).__ditonaPairId ?? (window as any).__pairId ?? null;
  if (!cur) return true; if (!pid) return true; return pid === cur;
}

// Events
window.addEventListener("rtc:peer-meta", (e: any) => {
  const { pairId, meta } = e?.detail || {};
  if (!samePair(pairId)) return;
  applyMeta(meta || {});
});
window.addEventListener("ditona:peer-meta", (e: any) => {
  // يدعم الشكل {pairId, meta} أو flat
  const d = e?.detail || {};
  const m = typeof d?.meta === "object" ? d.meta : d;
  if (!samePair(d?.pairId)) return;
  applyMeta(m || {});
});

// like:sync لتحديث العدّاد + القلوب
window.addEventListener("like:sync", (e: any) => {
  const { pairId, count, liked } = e?.detail || {};
  if (!samePair(pairId)) return;
  if (typeof count === "number" && el.likes()) el.likes()!.textContent = String(count);
  if (liked) burstHearts(4);
});

// مسح HUD عند البحث/زوج جديد
window.addEventListener("rtc:phase", (e: any) => {
  const ph = e?.detail?.phase;
  if (ph === "searching" || ph === "stopped") clearHUD();
});
window.addEventListener("rtc:pair", () => clearHUD());

// إعادة تحميل آخر ميتا محفوظة
try { const raw = sessionStorage.getItem("ditona:last_peer_meta"); if (raw) applyMeta(JSON.parse(raw)); } catch {}
