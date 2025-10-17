/**
 * Idempotent DOM updater for peer metadata badges.
 * Listens to:
 *   - "ditona:peer-meta"   -> apply meta immediately
 *   - "rtc:phase"          -> reset on searching|matched|stopped
 *   - "rtc:pair"           -> reset on new pair
 */

if (typeof window !== "undefined" && !(window as any).__peerMetaUiMounted) {
  (window as any).__peerMetaUiMounted = 1;

  const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;

  function reset() {
    try {
      const g = q('[data-ui="peer-gender"]');
      const ctry = q('[data-ui="peer-country"]');
      const cty = q('[data-ui="peer-city"]');
      const name = q('[data-ui="peer-name"]');
      const likes = q('[data-ui="peer-likes"]');
      const vip = q('[data-ui="peer-vip"]');
      const avatar = document.querySelector(
        '[data-ui="peer-avatar"]'
      ) as HTMLImageElement | HTMLElement | null;

      if (g) g.textContent = "—";
      if (ctry) ctry.textContent = "—";
      if (cty) cty.textContent = "";
      if (name) name.textContent = "";
      if (likes) likes.textContent = "0";
      if (vip) vip.classList.remove("is-vip");
      if (avatar) {
        if (avatar instanceof HTMLImageElement) avatar.src = "";
        else (avatar as HTMLElement).style.backgroundImage = "";
      }
    } catch {}
  }

  function apply(meta: any) {
    try {
      const g = q('[data-ui="peer-gender"]');
      const ctry = q('[data-ui="peer-country"]');
      const cty = q('[data-ui="peer-city"]');
      const name = q('[data-ui="peer-name"]');
      const likes = q('[data-ui="peer-likes"]');
      const vip = q('[data-ui="peer-vip"]');
      const avatar = document.querySelector(
        '[data-ui="peer-avatar"]'
      ) as HTMLImageElement | HTMLElement | null;

      if (g) g.textContent = meta?.gender ? String(meta.gender) : "—";
      if (ctry) ctry.textContent = meta?.country ? String(meta.country) : "—";
      if (cty) cty.textContent = meta?.city ? String(meta.city) : "";
      if (name) name.textContent = meta?.displayName ? String(meta.displayName) : "";
      if (likes) {
        const n =
          typeof meta?.likes === "number" ? meta.likes : parseInt(meta?.likes ?? "0", 10) || 0;
        likes.textContent = String(n);
      }
      if (vip) {
        if (meta?.vip) vip.classList.add("is-vip");
        else vip.classList.remove("is-vip");
      }
      if (avatar) {
        const url = meta?.avatar || meta?.avatarUrl || "";
        if (avatar instanceof HTMLImageElement) avatar.src = url || "";
        else (avatar as HTMLElement).style.backgroundImage = url ? `url("${url}")` : "";
      }
    } catch {}
  }

  const onPeerMeta = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    apply(detail);
  };

  const onPhase = (e: Event) => {
    const ph = (e as CustomEvent)?.detail?.phase;
    if (ph === "searching" || ph === "matched" || ph === "stopped") reset();
  };

  const onPair = () => reset();

  window.addEventListener("ditona:peer-meta", onPeerMeta as any);
  window.addEventListener("rtc:phase", onPhase as any);
  window.addEventListener("rtc:pair", onPair as any);

  // Cleanup
  window.addEventListener(
    "pagehide",
    () => {
      try {
        window.removeEventListener("ditona:peer-meta", onPeerMeta as any);
        window.removeEventListener("rtc:phase", onPhase as any);
        window.removeEventListener("rtc:pair", onPair as any);
      } catch {}
    },
    { once: true }
  );
}

export {};
