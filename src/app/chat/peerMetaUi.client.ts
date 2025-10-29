/**
 * DOM updater for peer metadata badges.
 * Sources meta from window events and sends my meta on attach/init.
 * Ensures gender is never empty: profile.gender -> filters.gender/selfGender -> "".
 */

if (typeof window !== "undefined" && !(window as any).__peerMetaUiMounted) {
  (window as any).__peerMetaUiMounted = 1;

  const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;

  function reset() {
    try {
      q('[data-ui="peer-gender"]')!.textContent = "—";
      const ctry = q('[data-ui="peer-country"]'); if (ctry) ctry.textContent = "—";
      const cty  = q('[data-ui="peer-city"]');    if (cty)  cty.textContent  = "";
      const name = q('[data-ui="peer-name"]');    if (name) name.textContent = "";
      const likes= q('[data-ui="peer-likes"]');
      if (likes) { likes.style.display = ""; likes.textContent = "0"; }
      const vip  = q('[data-ui="peer-vip"]');     if (vip)  vip.classList.remove("is-vip");
      const avatar = document.querySelector('[data-ui="peer-avatar"]') as HTMLImageElement | HTMLElement | null;
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

      if (ctry) {
        const hideCountry = !!meta?.hideCountry;
        ctry.textContent = hideCountry ? "—" : (meta?.country ? String(meta.country) : "—");
      }
      if (cty) {
        const hideCity = !!meta?.hideCity;
        cty.textContent = hideCity ? "" : (meta?.city ? String(meta.city) : "");
      }

      if (name) name.textContent = meta?.displayName ? String(meta.displayName) : "";

      if (likes) {
        const hideLikes = !!meta?.hideLikes;
        if (hideLikes) {
          likes.style.display = "none";
        } else {
          likes.style.display = "";
          const n = typeof meta?.likes === "number" ? meta.likes : parseInt(meta?.likes ?? "0", 10) || 0;
          likes.textContent = String(n);
        }
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

  function curPairId(): string | null {
    try { const w:any = globalThis as any; return w.__ditonaPairId || w.__pairId || null; } catch { return null; }
  }

  // ---- profile + fallbacks ----
  function stableDid(): string {
    try {
      const k = "ditona_did"; const v = localStorage.getItem(k);
      if (v) return v; const gen = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem(k, gen); return gen;
    } catch { return "did-" + Math.random().toString(36).slice(2, 9); }
  }

  function mapGender(v: unknown): string {
    const s = String(v ?? "").toLowerCase().trim();
    if (!s) return "";
    if (/^m(ale)?$/.test(s)) return "m";
    if (/^f(emale)?$/.test(s)) return "f";
    if (/^c(ouple|p)?$/.test(s)) return "c";
    if (/^l(gbtq?\+?)?$/.test(s) || /pride|rainbow/.test(s)) return "l";
    if (/^(everyone|all|u)$/.test(s)) return ""; // لا نرسل “غير محدد”
    // إذا كان مُخزّنًا أصلاً كـ m/f/c/l فاتركه
    if (/^[mfcl]$/.test(s)) return s;
    return "";
  }

  function readGeo() {
    try { const g = JSON.parse(localStorage.getItem("ditona_geo") || "null");
      return { country: g?.country ?? null, city: g?.city ?? null }; } catch { return { country:null, city:null }; }
  }

  function readFiltersGender(): string {
    try {
      const raw = localStorage.getItem("ditona.filters.v1")
        || localStorage.getItem("ditona_filters")
        || localStorage.getItem("filters");
      if (!raw) return "";
      const o = JSON.parse(raw);
      const s = o?.state ?? o;
      return mapGender(s?.selfGender ?? s?.gender);
    } catch { return ""; }
  }

  function readProfile() {
    let displayName = "", gender = "", avatarUrl = "", vip = false;
    let hideCountry = false, hideCity = false, hideLikes = false;
    try {
      const raw =
        localStorage.getItem("ditona.profile.v1") ||
        localStorage.getItem("ditona_profile") ||
        localStorage.getItem("profile");
      if (raw) {
        const p = JSON.parse(raw);
        const state = p?.state ?? p;
        displayName = state?.displayName ?? "";
        gender = mapGender(state?.gender);
        avatarUrl = state?.avatarDataUrl ?? "";
        vip = !!state?.vip;
        hideCountry = !!state?.privacy?.hideCountry;
        hideCity = !!state?.privacy?.hideCity;
        const showCount = state?.likes?.showCount;
        hideLikes = typeof showCount === "boolean" ? !showCount : false;
      }
    } catch {}
    // سقوط إلى الفلاتر إذا كان الجنس فارغًا
    if (!gender) gender = readFiltersGender();
    return { displayName, gender, avatarUrl, vip, hideCountry, hideCity, hideLikes };
  }

  function composeMyMeta() {
    const { country, city } = readGeo();
    const prof = readProfile();
    return {
      did: stableDid(),
      country,
      city,
      gender: prof.gender, // الآن لن تكون "" عندما يختار المستخدم جنسًا في البداية
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

  // ---- listeners ----
  const onPeerMeta = (e: Event) => apply((e as CustomEvent).detail);

  const onPhase = (e: Event) => {
    const ph = (e as CustomEvent)?.detail?.phase;
    if (ph === "searching" || ph === "stopped") reset();
  };

  const onPair = () => reset();

  const onLikeSync = (e: Event) => {
    try {
      const d = (e as CustomEvent).detail || {};
      const cur = curPairId();
      if (d?.pairId && cur && d.pairId !== cur) return;
      if (typeof d?.count !== "number") return;
      const el = q('[data-ui="peer-likes"]');
      if (el) el.textContent = String(Math.max(0, d.count | 0));
    } catch {}
  };

  window.addEventListener("ditona:peer-meta", onPeerMeta as any);
  window.addEventListener("rtc:phase", onPhase as any);
  window.addEventListener("rtc:pair", onPair as any);
  window.addEventListener("like:sync", onLikeSync as any);

  window.addEventListener("lk:attached", () => {
    sendMyMeta();
    try {
      const room: any = (globalThis as any).__lkRoom;
      const bin = new TextEncoder().encode(JSON.stringify({ t: "meta:init" }));
      room?.localParticipant?.publishData?.(bin, { reliable: true, topic: "meta" });
    } catch {}
  }, { passive: true } as any);

  window.addEventListener("ditona:meta:init", () => { sendMyMeta(); }, { passive: true } as any);

  window.addEventListener("pagehide", () => {
    try {
      window.removeEventListener("ditona:peer-meta", onPeerMeta as any);
      window.removeEventListener("rtc:phase", onPhase as any);
      window.removeEventListener("rtc:pair", onPair as any);
      window.removeEventListener("like:sync", onLikeSync as any);
    } catch {}
  }, { once: true });
}

export {};
