"use client";

/**
 * HUD لعرض بيانات الطرف B.
 * يعتمد فقط على أحداث:
 *  - "ditona:peer-meta"  detail={ pairId, meta:{...} }
 *  - "rtc:phase"         detail={ phase }
 *
 * لا يغيّر DOM selectors مطلقًا:
 *   [data-ui="peer-{avatar|vip|likes|name|country|city|gender}"]
 * يمسح عند searching|stopped فقط.
 */

type Meta = {
  displayName?: string;
  gender?: "m"|"f"|"c"|"l"|"u"|string;
  country?: string;
  city?: string;
  likes?: number;
  vip?: boolean;
  avatarUrl?: string;
};

const $ = (k: string): HTMLElement | null =>
  document.querySelector(`[data-ui="peer-${k}"]`);

function setText(el: Element | null, v: string | number | null | undefined) {
  if (!el) return;
  (el as HTMLElement).textContent = v == null ? "" : String(v);
}

/** تصحيح: استخدام محدد مباشر لـ data-ui="peer-avatar" بدل تركيب محدد داخل $ */
function setAvatar(url?: string) {
  const el = document.querySelector('[data-ui="peer-avatar"]') as HTMLImageElement | null;
  if (!el) return;

  if (url && url.length > 0) {
    el.src = url;
    el.removeAttribute("hidden");
  } else {
    el.setAttribute("hidden", "true");
    el.removeAttribute("src");
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

function updateVip(v?: boolean) {
  const el = $("vip");
  if (!el) return;
  setText(el, v ? "👑" : "🚫👑");
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
  updateVip(meta.vip);
  setText($("likes"), meta.likes ?? 0);
  setText($("name"), meta.displayName ?? "");
  setText($("country"), meta.country ?? "");
  setText($("city"), meta.city ?? "");

  const gEl = $("gender");
  setText(gEl, genderIcon(meta.gender));
  paintGenderColor(gEl, meta.gender);
}

function clearHUD() {
  setAvatar(undefined);
  updateVip(false);
  setText($("likes"), 0);
  setText($("name"), "");
  setText($("country"), "");
  setText($("city"), "");
  setText($("gender"), "");
}

(function boot() {
  // ظهور فوري لو كانت هناك قيمة مخزنة آخر جلسة
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
})();
