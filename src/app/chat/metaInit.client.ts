// src/app/chat/metaInit.client.ts
"use client";

import { normalizeGender } from "@/lib/gender";

type RawGeo = Partial<{ countryCode:string; country:string; city:string; cc:string; cn:string; ctry:string; country_name:string; locality:string; town:string; }>;
type Geo = { countryCode: string; country: string; city: string };

const LS_KEY = "ditona_geo";
const isBrowser = typeof window !== "undefined";

function normalizeGeo(r: RawGeo): Geo {
  const countryCode = (r.countryCode || r.cc || "").toString().toUpperCase();
  const country = (r.country || r.cn || r.ctry || r.country_name || "").toString();
  const city = (r.city || r.locality || r.town || "").toString();
  return { countryCode: countryCode || "", country: country || (countryCode || ""), city: city || "" };
}

function save(g: Geo) { try { localStorage.setItem(LS_KEY, JSON.stringify(g)); } catch {} }
function load(): Geo | null { try { const raw = localStorage.getItem(LS_KEY); return raw ? normalizeGeo(JSON.parse(raw)) : null; } catch { return null; } }
function emitGeo(g: Geo) { try { window.dispatchEvent(new CustomEvent("ditona:geo", { detail: g })); } catch {} }

async function fetchGeo(): Promise<Geo | null> {
  try {
    const r = await fetch("/api/geo", { method: "GET", credentials: "include", cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as RawGeo;
    const g = normalizeGeo(j);
    if (!g.countryCode && !g.country && !g.city) return null;
    return g;
  } catch { return null; }
}

function buildLocalMeta() {
  try {
    const geo = load();
    const profileRaw = JSON.parse(localStorage.getItem("ditona_profile") || "null") || {};
    const displayName = String(profileRaw.displayName || "A").slice(0, 24);
    const gender = normalizeGender(profileRaw.gender as any);
    const vip = !!profileRaw.vip;
    const likes = Number(profileRaw.likes || 0) || 0;
    const avatarUrl = typeof profileRaw.avatarUrl === "string" ? profileRaw.avatarUrl : undefined;

    const meta = {
      displayName, gender,
      country: geo?.countryCode || geo?.country || "",
      city: geo?.city || "",
      vip, likes, avatarUrl,
      did: (() => {
        try {
          const k = "ditona_did"; let v = localStorage.getItem(k);
          if (!v) { v = crypto?.randomUUID?.() || ("did-" + Math.random().toString(36).slice(2, 10)); localStorage.setItem(k, v); }
          return v;
        } catch { return "did-" + Math.random().toString(36).slice(2, 10); }
      })(),
    };

    (window as any).__ditonaLocalMeta = meta;
  } catch {}
}

(async function init() {
  if (!isBrowser) return;
  const cached = load(); if (cached) emitGeo(cached);
  const fresh = await fetchGeo(); if (fresh) { save(fresh); emitGeo(fresh); }
  buildLocalMeta();

  window.addEventListener("ditona:geo:refresh", async () => {
    const g = await fetchGeo(); if (g) { save(g); emitGeo(g); }
    buildLocalMeta();
    try { window.dispatchEvent(new CustomEvent("ditona:send-meta")); } catch {}
  });

  window.addEventListener("ditona:profile:updated", () => {
    buildLocalMeta();
    try { window.dispatchEvent(new CustomEvent("ditona:send-meta")); } catch {}
  });

  window.addEventListener("ditona:geo", () => {
    buildLocalMeta();
    try { window.dispatchEvent(new CustomEvent("ditona:send-meta")); } catch {}
  });
})().catch(() => {});
