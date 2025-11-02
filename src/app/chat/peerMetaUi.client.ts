// src/app/chat/peerMetaUi.client.ts
"use client";

/**
 * DOM updater لبادجات الطرف B.
 * مصدر الحقيقة: أحداث peer-meta فقط.
 * يستمع إلى:
 *  - "rtc:peer-meta"      detail = { pairId, meta }
 *  - "ditona:peer-meta"   detail = { pairId, meta } | flat meta (توافق)
 *  - "like:sync"          detail = { pairId, count, liked }
 *  - "rtc:pair" و "rtc:phase(searching|stopped)" لمسح العرض
 */

import { normalizeGender, genderSymbol } from "@/lib/gender";

type Meta = Partial<{
  displayName: string;
  gender: unknown;
  country: string;
  city: string;
  avatarUrl: string;
  likes: number;
  vip: boolean;
}>;

const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const el = {
  avatar: () => q('[data-ui="peer-avatar"]') as HTMLImageElement | null,
  name:   () => q('[data-ui="peer-name"]'),
  vip:    () => q('[data-ui="peer-vip"]'),
  likes:  () => q('[data-ui="peer-likes"]'),
  country:() => q('[data-ui="peer-country"]'),
  city:   () => q('[data-ui="peer-city"]'),
  gender: () => q('[data-ui="peer-gender"]'),
  heartsHost: () => q('[data-ui="like-hearts"]'),
};

function clearHUD() {
  el.name()?.replaceChildren();
  const a = el.avatar(); if (a) { a.src = ""; a.classList.add("hidden"); }
  el.vip()?.replaceChildren();
  if (el.likes()) el.likes()!.textContent = "";
  if (el.country()) el.country()!.textContent = "—";
  if (el.city()) el.city()!.textContent = "";
  if (el.gender()) el.gender()!.textContent = "";
}

function applyMeta(meta: Meta) {
  // خزّن آخر ميتا للرجوع عند إعادة التحميل
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

  const v = el.vip();
  if (v) v.textContent = meta.vip ? "👑" : "";

  if (typeof meta.likes === "number" && el.likes()) el.likes()!.textContent = String(meta.likes);

  if (meta.country && el.country()) el.country()!.textContent = String(meta.country).toUpperCase();
  if (meta.city && el.city()) el.city()!.textContent = meta.city;

  const g = normalizeGender(meta.gender);
  if (el.gender()) el.gender()!.textContent = genderSymbol(g) || "";
}

function samePair(pid?: string | null): boolean {
  const cur = (window as any).__ditonaPairId ?? (window as any).__pairId ?? null;
  if (!cur) return true;
  if (!pid) return true;
  return pid === cur;
}

/* ---- hearts effect ---- */
function burstHearts(n = 4) {
  const host = el.heartsHost();
  if (!host) return;
  for (let i = 0; i < n; i++) {
    const span = document.createElement("span");
    span.textContent = "💗";
    span.style.position = "absolute";
    span.style.left = `${50 + (Math.random() * 24 - 12)}%`;
    span.style.bottom = "8%";
    span.style.opacity = "0.9";
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

/* ---- event listeners ---- */
window.addEventListener("rtc:peer-meta", (e: any) => {
  const { pairId, meta } = e?.detail || {};
  if (!samePair(pairId)) return;
  applyMeta(meta || {});
});
window.addEventListener("ditona:peer-meta", (e: any) => {
  // قد يأتي الشكل موحّدًا {pairId, meta} أو مسطّحًا (قديم)
  const d = e?.detail || {};
  const meta = typeof d?.meta === "object" ? d.meta : d;
  applyMeta(meta || {});
});

// مزامنة الإعجاب: حدّث العدّاد وأطلق القلوب عند الإعجاب
window.addEventListener("like:sync", (e: any) => {
  const { pairId, count, liked } = e?.detail || {};
  if (!samePair(pairId)) return;
  if (typeof count === "number" && el.likes()) el.likes()!.textContent = String(count);
  if (liked) burstHearts(4);
});

// مسح عند البحث أو زوج جديد
window.addEventListener("rtc:phase", (e: any) => {
  const ph = e?.detail?.phase;
  if (ph === "searching" || ph === "stopped") clearHUD();
});
window.addEventListener("rtc:pair", () => clearHUD());

// إعادة تفعيل آخر ميتا محفوظة بعد إعادة التحميل
try {
  const raw = sessionStorage.getItem("ditona:last_peer_meta");
  if (raw) applyMeta(JSON.parse(raw));
} catch {}
