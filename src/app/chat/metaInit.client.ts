"use client";

/**
 * يبني الميتا المحلية ويُبقيها محدثة ويرسلها عند:
 *  - lk:attached
 *  - rtc:pair
 *  - ditona:meta:init  (وصول طلب من الطرف الآخر)
 * كما يحافظ على geo في localStorage وحدث "ditona:geo".
 * لا يستخدم أي تبعيات خارجية.
 */

/* --------------------------- Geo bootstrap (كما لديك) --------------------------- */

type RawGeo = Partial<{
  countryCode: string; country: string; city: string;
  cc: string; cn: string; ctry: string; country_name: string; locality: string; town: string;
}>;

type Geo = { countryCode: string; country: string; city: string };

const LS_GEO = "ditona_geo";
const isBrowser = typeof window !== "undefined";

function normalizeGeo(r: RawGeo): Geo {
  const countryCode = (r.countryCode || r.cc || "").toString().toUpperCase();
  const country = (r.country || r.cn || r.ctry || r.country_name || "").toString();
  const city = (r.city || r.locality || r.town || "").toString();
  return {
    countryCode: countryCode || "",
    country: country || (countryCode ? countryCode : ""),
    city: city || "",
  };
}

function geoSave(g: Geo) {
  try { localStorage.setItem(LS_GEO, JSON.stringify(g)); } catch {}
}

function geoLoad(): Geo | null {
  try {
    const raw = localStorage.getItem(LS_GEO);
    if (!raw) return null;
    return normalizeGeo(JSON.parse(raw));
  } catch { return null; }
}

function geoEmit(g: Geo) {
  try { window.dispatchEvent(new CustomEvent("ditona:geo", { detail: g })); } catch {}
}

async function geoFetch(): Promise<Geo | null> {
  try {
    const r = await fetch("/api/regions", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as RawGeo;
    const g = normalizeGeo(j);
    if (!g.countryCode && !g.country && !g.city) return null;
    return g;
  } catch { return null; }
}

/* ------------------------------ Local meta builder ----------------------------- */

function normalizeGender(x: unknown): "m" | "f" | "c" | "l" | "u" {
  const s = String(x ?? "").toLowerCase();
  if (s === "m" || s === "male") return "m";
  if (s === "f" || s === "female") return "f";
  if (s === "c" || s === "couple" || s === "paar") return "c";
  if (s === "l" || s.includes("lgbt")) return "l";
  return "u";
}

function readGeo(): Geo {
  return geoLoad() ?? { countryCode: "", country: "", city: "" };
}

function buildLocalMeta() {
  const geo = readGeo();
  const displayName =
    (localStorage.getItem("ditona_profile_name") || "").trim() || "A";
  const gender = normalizeGender(localStorage.getItem("ditona_profile_gender"));
  const vip = localStorage.getItem("ditona_vip") === "1";
  const avatarUrl = localStorage.getItem("ditona_avatar") || "";
  const likes = Number(localStorage.getItem("ditona_likes") || "0") || 0;

  const meta = {
    displayName,
    gender,
    country: (geo.countryCode || geo.country || "").toString().toUpperCase() || "",
    city: geo.city || "",
    likes,
    vip,
    avatarUrl,
  };
  try { (window as any).__ditonaLocalMeta = meta; } catch {}
  return meta;
}

function sendLocalMeta() {
  buildLocalMeta();
  try { window.dispatchEvent(new CustomEvent("ditona:send-meta")); } catch {}
}

/* ----------------------------------- Boot ----------------------------------- */

(async function init() {
  if (!isBrowser) return;

  // Geo: استخدم الكاش فورًا ثم حدّث من API
  const cached = geoLoad();
  if (cached) geoEmit(cached);
  const fresh = await geoFetch();
  if (fresh) { geoSave(fresh); geoEmit(fresh); }

  // refresh عند الطلب
  window.addEventListener("ditona:geo:refresh", async () => {
    const g = await geoFetch();
    if (g) { geoSave(g); geoEmit(g); }
  });

  // أبقِ الميتا محدثة عند أي تغيير تخزين
  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    if (
      e.key.startsWith("ditona_profile_") ||
      e.key === "ditona_vip" ||
      e.key === "ditona_avatar" ||
      e.key === "ditona_likes" ||
      e.key === LS_GEO
    ) {
      buildLocalMeta();
    }
  });

  // إرسال الميتا عند الالتحاق/الطلب/زوج جديد
  window.addEventListener("lk:attached", sendLocalMeta);
  window.addEventListener("rtc:pair", sendLocalMeta);
  window.addEventListener("ditona:meta:init", sendLocalMeta);

  // تهيئة أولية
  buildLocalMeta();
})();
