// src/app/chat/metaInit.client.ts
"use client";

/**
 * Initializes geo info for the session and broadcasts it.
 * Source of truth: GET /api/regions  (no cache, credentials included).
 * Persists under localStorage key "ditona_geo".
 * Emits "ditona:geo" on every update. Listens to "ditona:geo:refresh" to refetch.
 */

type RawGeo = Partial<{
  countryCode: string; country: string; city: string;
  cc: string; cn: string; ctry: string; country_name: string; locality: string; town: string;
}>;

type Geo = { countryCode: string; country: string; city: string };

const LS_KEY = "ditona_geo";
const isBrowser = typeof window !== "undefined";

function normalize(r: RawGeo): Geo {
  const countryCode =
    (r.countryCode || r.cc || "").toString().toUpperCase();
  const country =
    (r.country || r.cn || r.ctry || r.country_name || "").toString();
  const city =
    (r.city || r.locality || r.town || "").toString();
  return {
    countryCode: countryCode || "",
    country: country || (countryCode ? countryCode : ""),
    city: city || "",
  };
}

function save(g: Geo) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(g)); } catch {}
}

function load(): Geo | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return normalize(j);
  } catch { return null; }
}

function emit(g: Geo) {
  try {
    window.dispatchEvent(new CustomEvent("ditona:geo", { detail: g }));
  } catch {}
}

async function fetchGeo(): Promise<Geo | null> {
  try {
    const r = await fetch("/api/regions", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "accept": "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as RawGeo;
    const g = normalize(j);
    if (!g.countryCode && !g.country && !g.city) return null;
    return g;
  } catch { return null; }
}

async function init() {
  if (!isBrowser) return;

  // 1) use cached immediately if present
  const cached = load();
  if (cached) emit(cached);

  // 2) fetch fresh from API
  const fresh = await fetchGeo();
  if (fresh) { save(fresh); emit(fresh); }

  // 3) allow on-demand refresh
  window.addEventListener("ditona:geo:refresh", async () => {
    const g = await fetchGeo();
    if (g) { save(g); emit(g); }
  });
}

// side-effect boot
init().catch(() => {});
