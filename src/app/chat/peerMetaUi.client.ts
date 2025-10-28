// src/app/chat/peerMetaUi.client.ts
/**
 * Idempotent DOM updater for peer metadata badges.
 * Listens to:
 *   - "ditona:peer-meta"   -> apply meta immediately
 *   - "rtc:phase"          -> reset on searching|matched|stopped
 *   - "rtc:pair"           -> reset on new pair
 *   - "lk:attached"        -> send my meta on connect
 *   - "ditona:meta:init"   -> send my meta when requested
 *   - "like:sync"          -> update likes counter
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
      const avatar = document.querySelector('[data-ui="peer-avatar"]') as HTMLImageElement | HTMLElement | null;

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
      const avatar = document.querySelector('[data-ui="peer-avatar"]') as HTMLImageElement | HTMLElement | null;

      if (g) g.textContent = meta?.gender ? String(meta.gender) : "—";
      if (ctry) ctry.textContent = meta?.country ? String(meta.country) : "—";
      if (cty) cty.textContent = meta?.city ? String(meta.city) : "";
      if (name) name.textContent = meta?.displayName ? String(meta.displayName) : "";
      if (likes) {
        const n = typeof meta?.likes === "number" ? meta.likes : parseInt(meta?.likes ?? "0", 10) || 0;
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

  // helpers
  function curPairId(): string | null {
    try {
      const w: any = globalThis as any;
      return w.__ditonaPairId || w.__pairId || null;
    } catch {
      return null;
    }
  }

  // send my meta on demand
  function stableDid(): string {
    try {
      const k = "ditona_did";
      const v = localStorage.getItem(k);
      if (v) return v;
      const gen = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem(k, gen);
      return gen;
    } catch {
      return "did-" + Math.random().toString(36).slice(2, 9);
    }
  }

  function readGeo() {
    try {
      const g = JSON.parse(localStorage.getItem("ditona_geo") || "null");
      return { country: g?.country ?? null, city: g?.city ?? null };
    } catch {
      return { country: null, city: null };
    }
  }

  function readProfile() {
    let displayName = "";
    let gender = "";
    let avatarUrl = "";
    let vip = false;
    let hideCountry = false;
    let hideCity = false;
    let hideLikes = false;
    try {
      const raw = localStorage.getItem("ditona_profile") || localStorage.getItem("profile");
      if (raw) {
        const p = JSON.parse(raw);
        displayName = p?.state?.displayName ?? p?.displayName ?? "";
        gender = p?.state?.gender ?? p?.gender ?? "";
        avatarUrl = p?.state?.avatarDataUrl ?? p?.avatarDataUrl ?? "";
        vip = !!(p?.state?.vip ?? p?.vip);
        hideCountry = !!(p?.state?.privacy?.hideCountry ?? p?.privacy?.hideCountry);
        hideCity = !!(p?.state?.privacy?.hideCity ?? p?.privacy?.hideCity);
        const showCount = !!(p?.state?.likes?.showCount ?? p?.likes?.showCount ?? true);
        hideLikes = !showCount;
      }
    } catch {}
    return { displayName, gender, avatarUrl, vip, hideCountry, hideCity, hideLikes };
  }

  function composeMyMeta() {
    const { country, city } = readGeo();
    const prof = readProfile();
    return {
      did: stableDid(),
      country,
      city,
      gender: prof.gender,
      avatarUrl: prof.avatarUrl,
      displayName: prof.displayName,
      vip: prof.vip,
      likes: 0,
      hideCountry: !!prof.hideCountry,
      hideCity: !!prof.hideCity,
      hideLikes: !!prof.hideLikes,
    };
  }

  async function sendMyMeta() {
    try {
      const room: any = (globalThis as any).__lkRoom;
      if (!room?.localParticipant?.publishData) return;
      const payload = { t: "peer-meta", payload: composeMyMeta() };
      const bin = new TextEncoder().encode(JSON.stringify(payload));
      await room.localParticipant.publishData(bin, { reliable: true, topic: "meta" });
    } catch {}
  }

  // listeners
  const onPeerMeta = (e: Event) => apply((e as CustomEvent).detail);

  const onPhase = (e: Event) => {
    const ph = (e as CustomEvent)?.detail?.phase;
    if (ph === "searching" || ph === "matched" || ph === "stopped") reset();
  };

  const onPair = () => reset();

  // NEW: update likes counter from like:sync
  const onLikeSync = (e: Event) => {
    try {
      const d = (e as CustomEvent).detail || {};
      const cur = curPairId();
      if (d?.pairId && cur && d.pairId !== cur) return;
      if (typeof d?.count !== "number") return;
      const el = q('[data-ui="peer-likes"]');
      if (el) el.textContent = String(Math.max(0, d.count));
    } catch {}
  };

  window.addEventListener("ditona:peer-meta", onPeerMeta as any);
  window.addEventListener("rtc:phase", onPhase as any);
  window.addEventListener("rtc:pair", onPair as any);
  window.addEventListener("like:sync", onLikeSync as any);

  window.addEventListener("lk:attached", () => { sendMyMeta(); }, { passive: true } as any);
  window.addEventListener("ditona:meta:init", () => { sendMyMeta(); }, { passive: true } as any);

  window.addEventListener(
    "pagehide",
    () => {
      try {
        window.removeEventListener("ditona:peer-meta", onPeerMeta as any);
        window.removeEventListener("rtc:phase", onPhase as any);
        window.removeEventListener("rtc:pair", onPair as any);
        window.removeEventListener("like:sync", onLikeSync as any);
      } catch {}
    },
    { once: true }
  );
}

export {};
