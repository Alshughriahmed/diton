"use client";

/**
 * محدِّث DOM لبادجات ميتاداتا الطرف B.
 * يستمع إلى:
 *  - "ditona:peer-meta"  → تطبيق الميتا فورًا
 *  - "rtc:phase"         → مسح عند searching | stopped
 *  - "rtc:pair"          → مسح عند زوج جديد
 *
 * لا يغيّر محددات DOM مطلقًا:
 *   [data-ui="peer-{avatar|vip|likes|name|country|city|gender}"]
 */

type Meta = {
  displayName?: string;
  gender?: "m" | "f" | "c" | "l" | "u" | string;
  country?: string;
  city?: string;
  likes?: number;
  vip?: boolean;
  avatarUrl?: string;
};

const qs = (k: string): HTMLElement | null =>
  document.querySelector(`[data-ui="peer-${k}"]`);

function setText(el: Element | null, v: string | number | null | undefined) {
  if (!el) return;
  (el as HTMLElement).textContent = v == null ? "" : String(v);
}

function setAvatar(url?: string) {
  const img = document.querySelector(
    '[data-ui="peer-avatar"]'
  ) as HTMLImageElement | null;
  if (!img) return;
  if (url && url.length > 0) {
    img.src = url;
    img.removeAttribute("hidden");
  } else {
    img.setAttribute("hidden", "true");
    img.removeAttribute("src");
  }
}

function genderIcon(g?: string): string {
  const s = (g || "u").toLowerCase();
  if (s === "m") return "♂";
  if (s === "f") return "♀";
  if (s === "c") return "⚤";
  if (s === "l") return "🏳️‍🌈";
  return "⚧";
}

function paintGenderColor(el: HTMLElement | null, g?: string) {
  if (!el) return;
  el.classList.remove(
    "text-blue-500",
    "text-red-500",
    "text-rose-700",
    "bg-gradient-to-r",
    "from-red-500",
    "via-yellow-400",
    "to-blue-500",
    "bg-clip-text",
    "text-transparent"
  );
  const s = (g || "u").toLowerCase();
  if (s === "m") el.classList.add("text-blue-500");
  else if (s === "f") el.classList.add("text-red-500");
  else if (s === "c") el.classList.add("text-rose-700");
  else if (s === "l")
    el.classList.add(
      "bg-gradient-to-r",
      "from-red-500",
      "via-yellow-400",
      "to-blue-500",
      "bg-clip-text",
      "text-transparent"
    );
}

function updateHUD(meta: Meta) {
  setAvatar(meta.avatarUrl);
  setText(qs("name"), meta.displayName ?? "");
  setText(qs("likes"), meta.likes ?? 0);
  setText(qs("country"), meta.country ?? "");
  setText(qs("city"), meta.city ?? "");
  const gEl = qs("gender");
  setText(gEl, genderIcon(meta.gender));
  paintGenderColor(gEl, meta.gender);
  const vipEl = qs("vip");
  setText(vipEl, meta.vip ? "👑" : "🚫👑");
}

function clearHUD() {
  setAvatar(undefined);
  setText(qs("name"), "");
  setText(qs("likes"), 0);
  setText(qs("country"), "");
  setText(qs("city"), "");
  setText(qs("gender"), "");
  setText(qs("vip"), "🚫👑");
}

(function boot() {
  // ظهور فوري من آخر جلسة إن وُجد
  try {
    const raw = sessionStorage.getItem("ditona:last_peer_meta");
    if (raw) updateHUD(JSON.parse(raw));
  } catch {}

  window.addEventListener("ditona:peer-meta", (e: any) => {
    const meta = (e?.detail?.meta ?? {}) as Meta;
    try {
      sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(meta));
    } catch {}
    updateHUD(meta);
  });

  window.addEventListener("rtc:phase", (e: any) => {
    const ph = e?.detail?.phase;
    if (ph === "searching" || ph === "stopped") clearHUD();
  });

  window.addEventListener("rtc:pair", clearHUD);
})();
