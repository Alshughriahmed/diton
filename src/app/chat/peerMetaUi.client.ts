// src/app/chat/peerMetaUi.client.ts
"use client";

/**
 * DOM updater لبادجات الطرف B.
 * مصدر الحقيقة: أحداث peer-meta فقط.
 * يستمع إلى:
 *  - "rtc:peer-meta"  detail = { pairId, meta }
 *  - "ditona:peer-meta" detail = flat meta (توافق قديم)
 *  - "rtc:pair" و "rtc:phase(searching|stopped)" لمسح العرض
 */

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
  name: () => q('[data-ui="peer-name"]'),
  vip: () => q('[data-ui="peer-vip"]'),
  likes: () => q('[data-ui="peer-likes"]'),
  country: () => q('[data-ui="peer-country"]'),
  city: () => q('[data-ui="peer-city"]'),
  gender: () => q('[data-ui="peer-gender"]'),
};

function normalizeGender(v: unknown): "m"|"f"|"c"|"l"|"u" {
  const s = String(v ?? "").trim().toLowerCase();
  if (["m","male","man","boy"].includes(s)) return "m";
  if (["f","female","woman","girl"].includes(s)) return "f";
  if (["c","couple","paar","زوج","زوجان"].includes(s)) return "c";
  if (["l","lgbt","gay","bi","queer","🏳️‍🌈"].includes(s)) return "l";
  return "u";
}
function genderSymbol(n: "m"|"f"|"c"|"l"|"u"): string {
  if (n==="m") return "♂";
  if (n==="f") return "♀";
  if (n==="c") return "👫";
  if (n==="l") return "🏳️‍🌈";
  return ""; // لا نظهر رمزًا لـ u
}

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
  // خزّن آخر ميتا للرجوع عند إعادة تحميل
  try {
    (window as any).__ditonaLastPeerMeta = meta;
    sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(meta));
  } catch {}

  if (meta.displayName) el.name()?.replaceChildren(document.createTextNode(meta.displayName));

  const a = el.avatar();
  if (a && meta.avatarUrl) {
    a.src = String(meta.avatarUrl);
    a.classList.remove("hidden");
  }

  const v = el.vip();
  if (v) v.textContent = meta.vip ? "👑" : "";

  if (typeof meta.likes === "number" && el.likes()) el.likes()!.textContent = String(meta.likes);

  if (meta.country && el.country()) el.country()!.textContent = meta.country.toUpperCase();
  if (meta.city && el.city()) el.city()!.textContent = meta.city;

  const g = normalizeGender(meta.gender);
  if (el.gender()) el.gender()!.textContent = genderSymbol(g);
}

function samePair(pid?: string | null): boolean {
  const cur = (window as any).__ditonaPairId ?? (window as any).__pairId ?? null;
  if (!cur) return true;
  if (!pid) return true;
  return pid === cur;
}

// مستمعو الأحداث
window.addEventListener("rtc:peer-meta", (e: any) => {
  const { pairId, meta } = e?.detail || {};
  if (!samePair(pairId)) return;
  applyMeta(meta || {});
});
window.addEventListener("ditona:peer-meta", (e: any) => {
  // توافق قديم: الحدث يحمل meta مسطّحة
  applyMeta(e?.detail || {});
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
