// src/app/chat/peerMetaUi.client.ts
"use client";

/**
 * Peer HUD DOM updater
 * مصادر الأحداث:
 *  - "ditona:peer-meta"  detail قد يكون {meta:{...}} أو مفلطحًا
 *  - "like:sync"         detail = {pairId, count, liked}
 *  - "rtc:pair"          detail = {pairId}
 *  - "rtc:phase"         detail = {phase:'searching'|'connecting'|'connected'|'stopped'}
 *  - "lk:attached"       يطلق طلب meta:init (يستكمله dcMetaResponder)
 *
 * لا يزيل عقد DOM. يحدّث النصوص فقط. ألوان ورموز الجنس مضبوطة.
 * حارس pairId مرن: إذا كان حدث بدون pairId لا يُسقط.
 */

type AnyObj = Record<string, any>;

function pidNow(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

function normalizeDetail(d: AnyObj | undefined): AnyObj {
  if (!d || typeof d !== "object") return {};
  if (d.meta && typeof d.meta === "object") {
    const { meta, pairId } = d;
    return { pairId: pairId ?? meta.pairId ?? pidNow(), ...meta };
  }
  return d;
}

/* ======= gender formatting ======= */
function normGender(g: unknown): "m"|"f"|"c"|"l"|"u" {
  const s = String(g || "").toLowerCase();
  if (s === "m" || s === "male") return "m";
  if (s === "f" || s === "female") return "f";
  if (s === "c" || s === "couple") return "c";
  if (s === "l" || s === "lgbt" || s === "lgbtq") return "l";
  return "u";
}
function genderSymbol(g: "m"|"f"|"c"|"l"|"u"): string {
  if (g === "m") return "♂";
  if (g === "f") return "♀";
  if (g === "c") return "⚤";
  if (g === "l") return "🏳️‍🌈";
  return "";
}
function genderClass(g: "m"|"f"|"c"|"l"|"u"): string {
  if (g === "m") return "text-blue-500";
  if (g === "f") return "text-red-500";
  if (g === "c") return "text-rose-700";
  if (g === "l") return "bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 bg-clip-text text-transparent";
  return "";
}

/* ======= DOM helpers ======= */
function setText(sel: string, text: string) {
  const el = document.querySelector<HTMLElement>(`[data-ui="${sel}"]`);
  if (el) el.textContent = text;
}
function setAttr(sel: string, attr: string, value?: string) {
  const el = document.querySelector<HTMLElement>(`[data-ui="${sel}"]`);
  if (el && value) el.setAttribute(attr, value);
}
function setVip(vip?: boolean) {
  const el = document.querySelector<HTMLElement>(`[data-ui="peer-vip"]`);
  if (!el) return;
  el.textContent = vip ? "👑" : "🚫👑";
}
function setAvatar(url?: string) {
  const el = document.querySelector<HTMLImageElement>(`[data-ui="peer-avatar"]`);
  if (!el) return;
  if (url) { el.src = url; el.style.opacity = "1"; }
  else { el.removeAttribute("src"); el.style.opacity = "0.4"; }
}
function setGender(g?: unknown) {
  const n = normGender(g);
  const el = document.querySelector<HTMLElement>(`[data-ui="peer-gender"]`);
  if (!el) return;
  const sym = genderSymbol(n);
  el.className = `${el.className} ${genderClass(n)}`; // يضيف اللون دون مسح بقية الأصناف
  el.textContent = sym;
}

/* ======= state ======= */
let currentPid: string | null = null;
let lastMeta: AnyObj | null = null;

function acceptForCurrentPair(incomingPid?: string | null): boolean {
  const now = pidNow();
  currentPid = now || currentPid;
  if (!incomingPid || !now) return true;            // مرن: لا نسقط إذا غاب أيهما
  return incomingPid === now;
}

/* ======= apply meta to DOM ======= */
function applyPeerMeta(detail: AnyObj) {
  lastMeta = detail;
  // أعلى يسار: avatar + vip + likes + name
  setVip(detail.vip);
  setAvatar(detail.avatarUrl);
  if (typeof detail.likes === "number") setText("peer-likes", String(detail.likes));
  if (detail.displayName) setText("peer-name", String(detail.displayName));

  // أسفل يسار: Country – City + gender
  const country = (detail.country || "").toString().toUpperCase();
  const city = (detail.city || "").toString();
  const line = country && city ? `${country}  –  ${city}` : country || city || "–";
  setText("peer-country", line);
  // city عنصر مستقل إن كان لديك عنصر منفصل:
  setText("peer-city", city || "");
  setGender(detail.gender);
}

function clearPeerMeta() {
  setText("peer-name", "");
  setText("peer-likes", "");
  setText("peer-country", "–");
  setText("peer-city", "");
  setGender("u");
  setVip(false);
  setAvatar("");
}

/* ======= listeners ======= */
function onPeerMeta(ev: Event) {
  const raw = (ev as CustomEvent).detail as AnyObj;
  const d = normalizeDetail(raw);
  if (!acceptForCurrentPair(d.pairId ?? null)) return;
  applyPeerMeta(d);
}

function onLikeSync(ev: Event) {
  const d = (ev as CustomEvent).detail as AnyObj;
  if (!acceptForCurrentPair(d?.pairId ?? null)) return;
  if (typeof d.count === "number") setText("peer-likes", String(d.count));
}

function onRtcPair(ev: Event) {
  currentPid = (ev as CustomEvent).detail?.pairId ?? null;
  clearPeerMeta();
  // نعطي تلميحًا بصريًا سريعًا أن البطاقة نشِطة
  setText("peer-country", "–");
}

function onRtcPhase(ev: Event) {
  const ph = (ev as CustomEvent).detail?.phase;
  if (ph === "searching" || ph === "stopped") clearPeerMeta();
}

/* طلب meta من الطرف الآخر عند الارتباط */
function onLkAttached() {
  try {
    window.dispatchEvent(new CustomEvent("ditona:meta:init"));
  } catch {}
}

/* boot */
(function boot() {
  window.addEventListener("ditona:peer-meta", onPeerMeta as any, { passive: true } as any);
  window.addEventListener("like:sync", onLikeSync as any, { passive: true } as any);
  window.addEventListener("rtc:pair", onRtcPair as any, { passive: true } as any);
  window.addEventListener("rtc:phase", onRtcPhase as any, { passive: true } as any);
  window.addEventListener("lk:attached", onLkAttached as any, { passive: true } as any);

  // طبّق آخر ميتا محفوظة إن وُجدت لعرض أولي
  try {
    const w: any = globalThis as any;
    const cached = w.__ditonaLastPeerMeta || JSON.parse(sessionStorage.getItem("ditona:last_peer_meta") || "null");
    if (cached && typeof cached === "object") applyPeerMeta(normalizeDetail(cached));
  } catch {}
})();
