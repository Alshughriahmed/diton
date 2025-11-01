"use client";

/**
 * يحدّث HUD لمعلومات الطرف B من أحداث:
 *  - "ditona:peer-meta" detail={ pairId, meta:{...} }
 *  - "rtc:phase"        detail={ phase }
 * لا يغيّر محددات DOM:
 *   [data-ui="peer-{avatar|vip|likes|name|country|city|gender}"]
 * يمسح عند searching|stopped فقط.
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

function qs<T extends Element = HTMLElement>(k: string): T | null {
  return document.querySelector(`[data-ui="peer-${k}"]`) as T | null;
}

function setText(el: Element | null, v: string | number | null | undefined) {
  if (!el) return;
  (el as HTMLElement).textContent = v == null ? "" : String(v);
}

function setAvatar(url?: string) {
  const img = qs<HTMLImageElement>("avatar");
  if (!img) return;
  if (url) {
    img.src = url;
    img.classList.remove("hidden");
  } else {
    img.removeAttribute("src");
    img.classList.add("hidden");
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
  setText(qs("vip"), meta.vip ? "👑" : "🚫👑");
  setText(qs("likes"), meta.likes ?? 0);
  setText(qs("country"), meta.country ?? "");
  setText(qs("city"), meta.city ?? "");
  const gEl = qs<HTMLElement>("gender");
  setText(gEl, genderIcon(meta.gender));
  paintGenderColor(gEl, meta.gender);
}

function clearHUD() {
  setAvatar(undefined);
  setText(qs("name"), "");
  setText(qs("vip"), "🚫👑");
  setText(qs("likes"), 0);
  setText(qs("country"), "");
  setText(qs("city"), "");
  setText(qs("gender"), "");
}

(function boot() {
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
