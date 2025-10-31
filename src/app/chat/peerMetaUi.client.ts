// src/app/chat/peerMetaUi.client.ts
"use client";

/**
 * محدِّث DOM لبادجات الطرف B فقط.
 * يحافظ على:
 *  - الحارس pairId لإسقاط أي أحداث متأخرة
 *  - كاش أولي من sessionStorage: "ditona:last_peer_meta"
 * يستمع إلى:
 *  - "ditona:peer-meta"  ← المصدر الوحيد لبلد/مدينة/جنس/اسم/أفاتار/VIP/likes للطرف B
 *  - "like:sync"         ← تحديث عدّاد إعجابات B فقط
 *  - "rtc:pair","lk:attached" ← إعادة تطبيق الكاش فورًا عند تغيّر الزوج/الملحق
 *  - "rtc:phase"         ← مسح لطيف للنصوص عند searching|stopped دون إخفاء العناصر
 *
 * لا يغيّر محددات DOM:
 *   peer-country, peer-city, peer-gender, peer-name, peer-likes, peer-vip, peer-avatar
 */

type NormGender = "m" | "f" | "c" | "l" | "u";
type PeerMeta = {
  pairId?: string;
  displayName?: string;
  vip?: boolean;
  likes?: number;
  hideLikes?: boolean;
  country?: string;
  hideCountry?: boolean;
  city?: string;
  hideCity?: boolean;
  gender?: NormGender | string;
  avatarUrl?: string;
  avatar?: string; // توافق قديم
};

function curPair(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

function readCached(): PeerMeta {
  try {
    const raw = sessionStorage.getItem("ditona:last_peer_meta");
    return raw ? (JSON.parse(raw) as PeerMeta) : {};
  } catch {
    return {};
  }
}

function writeCached(m: PeerMeta) {
  try {
    sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(m));
  } catch {}
}

function normGender(g: unknown): NormGender {
  const s = String(g ?? "").toLowerCase().trim();
  if (s === "m" || s === "male") return "m";
  if (s === "f" || s === "female") return "f";
  if (s === "c" || s === "couple") return "c";
  if (s === "l" || s === "lgbt" || s === "lgbti" || s === "lgbtq") return "l";
  return "u";
}
function genderSymbol(g: NormGender): string {
  switch (g) {
    case "m":
      return "♂";
    case "f":
      return "♀";
    case "c":
      return "⚤";
    case "l":
      return "🏳️‍🌈";
    default:
      return "";
  }
}
function genderColor(g: NormGender): string {
  switch (g) {
    case "m":
      return "text-blue-500";
    case "f":
      return "text-red-500";
    case "c":
      return "text-rose-700";
    case "l":
      // الإيموجي كما هو
      return "";
    default:
      return "";
  }
}

function qs(sel: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-ui="${sel}"]`);
}

function render(meta: PeerMeta) {
  const countryEl = qs("peer-country");
  const cityEl = qs("peer-city");
  const genderEl = qs("peer-gender");
  const nameEl = qs("peer-name");
  const likesEl = qs("peer-likes");
  const vipEl = qs("peer-vip");
  const avatarEl = qs("peer-avatar") as HTMLImageElement | null;

  // بلد/مدينة
  if (countryEl) countryEl.textContent = meta.hideCountry ? "" : meta.country || "";
  if (cityEl) cityEl.textContent = meta.hideCity ? "" : meta.city || "";

  // الجنس
  if (genderEl) {
    const g = normGender(meta.gender);
    genderEl.textContent = genderSymbol(g);
    // أحجام الرموز المطلوبة: 1.5rem / 1.75rem
    genderEl.classList.remove(
      "text-blue-500",
      "text-red-500",
      "text-rose-700",
      "text-transparent",
      "bg-clip-text",
      "bg-gradient-to-r",
      "from-red-500",
      "via-yellow-400",
      "to-blue-500"
    );
    const cls = genderColor(g);
    if (cls) genderEl.classList.add(cls);
    genderEl.classList.add("font-semibold");
    genderEl.style.setProperty("font-size", "1.5rem");
    genderEl.style.setProperty("--tw-text-opacity", "1"); // لضمان التلوين
    // على الشاشات الأكبر
    try {
      const mq = window.matchMedia("(min-width: 640px)");
      const f = () => genderEl.style.setProperty("font-size", mq.matches ? "1.75rem" : "1.5rem");
      mq.addEventListener?.("change", f);
      f();
    } catch {}
  }

  // الاسم
  if (nameEl) nameEl.textContent = meta.displayName || "";

  // VIP
  if (vipEl) {
    if (typeof meta.vip === "boolean") vipEl.textContent = meta.vip ? "👑" : "🚫👑";
    else vipEl.textContent = "";
  }

  // likes (B فقط)
  if (likesEl) {
    const txt =
      meta?.hideLikes ? "" : typeof meta?.likes === "number" ? `❤️ ${meta.likes}` : "";
    likesEl.textContent = txt;
  }

  // avatar
  if (avatarEl) {
    const url = meta?.avatarUrl || meta?.avatar || "";
    if (url) {
      avatarEl.src = url;
      avatarEl.alt = "";
    }
  }
}

function apply(meta: PeerMeta) {
  const pidEvt = meta?.pairId;
  const pidNow = curPair();
  if (pidEvt && pidNow && pidEvt !== pidNow) return; // إسقاط
  writeCached(meta);
  render(meta);
}

// تشغيل
(function boot() {
  // إظهار الكاش فورًا
  const cached = readCached();
  if (cached && Object.keys(cached).length) render(cached);

  // مستمعو الأحداث
  const onMeta = (e: any) => apply(e?.detail || {});
  const onLikeSync = (e: any) => {
    const d = e?.detail || {};
    const pidEvt = d?.pairId || curPair();
    const pidNow = curPair();
    if (pidEvt && pidNow && pidEvt !== pidNow) return;
    if (typeof d.count === "number") {
      const m = { ...readCached(), likes: d.count };
      writeCached(m);
      render(m);
    }
  };
  const onPair = () => {
    const m = readCached();
    if (m && Object.keys(m).length) render(m);
  };
  const onAttached = onPair;
  const onPhase = (e: any) => {
    const ph = e?.detail?.phase;
    if (ph === "boot" || ph === "idle" || ph === "searching" || ph === "stopped") {
      // مسح لطيف للنصوص فقط
      const m = readCached();
      render({
        ...m,
        displayName: "",
        country: "",
        city: "",
        gender: "u",
      });
    }
  };

  window.addEventListener("ditona:peer-meta", onMeta as any, { passive: true } as any);
  window.addEventListener("like:sync", onLikeSync as any, { passive: true } as any);
  window.addEventListener("rtc:pair", onPair as any, { passive: true } as any);
  window.addEventListener("lk:attached", onAttached as any, { passive: true } as any);
  window.addEventListener("rtc:phase", onPhase as any, { passive: true } as any);

  // تنظيف عند HMR أو الخروج
  (globalThis as any).__ditonaPeerMetaCleanup = () => {
    window.removeEventListener("ditona:peer-meta", onMeta as any);
    window.removeEventListener("like:sync", onLikeSync as any);
    window.removeEventListener("rtc:pair", onPair as any);
    window.removeEventListener("lk:attached", onAttached as any);
    window.removeEventListener("rtc:phase", onPhase as any);
  };
})();
