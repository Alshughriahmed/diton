"use client";

/**
 * Peer meta → UI bridge.
 * - Listens to "ditona:peer-meta" and updates [data-ui] targets.
 * - Mirrors to "ditona:peer-meta-ui" for legacy DOM hooks.
 * - Resets on rtc:phase(searching|matched|stopped) and rtc:pair.
 * - Caches last meta in sessionStorage to survive reloads.
 */

declare global {
  interface Window { __peerMetaUiMounted?: 1 }
}

type Meta = {
  displayName?: string;
  avatarUrl?: string;
  vip?: boolean;
  country?: string;
  city?: string;
  gender?: string; // normalized short: m|f|c|l|u  or long strings from older clients
  likes?: number;
};

function text(el: Element | null, v: string | number | undefined) {
  const e = el as HTMLElement | null;
  if (!e) return;
  e.textContent = v === undefined || v === null ? "" : String(v);
}

function attr(el: Element | null, name: string, v?: string) {
  const e = el as HTMLElement | null;
  if (!e) return;
  if (!v) e.removeAttribute(name);
  else e.setAttribute(name, v);
}

function clearDom() {
  try {
    text(document.querySelector('[data-ui="peer-name"]'), "");
    text(document.querySelector('[data-ui="peer-country"]'), "");
    text(document.querySelector('[data-ui="peer-city"]'), "");
    text(document.querySelector('[data-ui="peer-gender"]'), "");
    text(document.querySelector('[data-ui="peer-likes"]'), "");
    const av = document.querySelector('[data-ui="peer-avatar"]') as HTMLImageElement | null;
    if (av) av.src = "";
    const vip = document.querySelector('[data-ui="peer-vip"]');
    if (vip) attr(vip, "hidden", "true");
  } catch {}
}

function longGender(g?: string): string {
  const s = String(g || "").toLowerCase().trim();
  if (!s) return "";
  if (s === "m" || s.startsWith("male")) return "Male";
  if (s === "f" || s.startsWith("female")) return "Female";
  if (s === "c" || s.startsWith("couple") || s.startsWith("couples")) return "Couples";
  if (s === "l" || s.includes("lgbt")) return "LGBT";
  return "";
}

function updateDom(meta: Meta) {
  try {
    text(document.querySelector('[data-ui="peer-name"]'), meta.displayName || "");
    text(document.querySelector('[data-ui="peer-country"]'), meta.country || "");
    text(document.querySelector('[data-ui="peer-city"]'), meta.city || "");
    text(document.querySelector('[data-ui="peer-gender"]'), longGender(meta.gender));
    text(document.querySelector('[data-ui="peer-likes"]'), typeof meta.likes === "number" ? meta.likes : "");

    const av = document.querySelector('[data-ui="peer-avatar"]') as HTMLImageElement | null;
    if (av && meta.avatarUrl) av.src = meta.avatarUrl;

    const vip = document.querySelector('[data-ui="peer-vip"]');
    if (vip) {
      if (meta.vip) vip.removeAttribute("hidden");
      else vip.setAttribute("hidden", "true");
    }
  } catch {}
}

function save(meta: Meta) {
  try { sessionStorage.setItem("ditona_peer_meta", JSON.stringify(meta || {})); } catch {}
}
function load(): Meta | null {
  try {
    const s = sessionStorage.getItem("ditona_peer_meta");
    if (!s) return null;
    return JSON.parse(s);
  } catch { return null; }
}

if (typeof window !== "undefined" && !window.__peerMetaUiMounted) {
  window.__peerMetaUiMounted = 1;

  // Initial from cache
  const cached = load();
  if (cached) updateDom(cached);

  const onMeta = (e: Event) => {
    const meta = (e as CustomEvent).detail as Meta;
    if (!meta) return;
    save(meta);
    updateDom(meta);
    // forward for older hooks
    try { window.dispatchEvent(new CustomEvent("ditona:peer-meta-ui", { detail: meta })); } catch {}
  };

  const onPhase = (e: Event) => {
    const phase = (e as CustomEvent).detail?.phase;
    if (phase === "searching" || phase === "matched" || phase === "stopped") {
      clearDom();
      save({});
    }
  };

  const onPair = () => { clearDom(); };

  window.addEventListener("ditona:peer-meta", onMeta as any);
  window.addEventListener("rtc:phase", onPhase as any);
  window.addEventListener("rtc:pair", onPair as any);

  window.addEventListener("pagehide", () => {
    try {
      window.removeEventListener("ditona:peer-meta", onMeta as any);
      window.removeEventListener("rtc:phase", onPhase as any);
      window.removeEventListener("rtc:pair", onPair as any);
    } catch {}
  }, { once: true });
}

export {};
