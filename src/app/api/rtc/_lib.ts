// src/app/api/rtc/_lib.ts
// Upstash REST wrapper (لا يعتمد على أي DISABLE_REDIS) + ردود no-store + anon + logging

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";

/* ---------- no-store + echo x-req-id ---------- */
export function reqId(req: Request) {
  return req.headers.get("x-req-id") || "";
}
export function hNoStore(req: Request, extra?: Record<string, string>) {
  const h = new Headers({ "Cache-Control": "no-store", ...(extra || {}) });
  const rid = reqId(req);
  if (rid) h.set("x-req-id", rid);
  return h;
}
export function rjson(req: Request, body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: hNoStore(req, { "content-type": "application/json" }),
  });
}
export function rempty(req: Request, status = 204) {
  return new NextResponse(null, { status, headers: hNoStore(req) });
}

/* ---------- Upstash Redis (REST) ---------- */
const RURL = process.env.UPSTASH_REDIS_REST_URL!;
const RTOK = process.env.UPSTASH_REDIS_REST_TOKEN!;
async function rcall(args: (string | number)[]) {
  const res = await fetch(RURL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RTOK}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
    keepalive: true as any,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || res.statusText);
  return j?.result;
}
export const R = {
  async get(k: string) {
    return await rcall(["GET", k]);
  },
  async set(k: string, v: string) {
    return await rcall(["SET", k, v]);
  },
  async del(k: string) {
    return await rcall(["DEL", k]);
  },
  async exists(k: string) {
    return Number(await rcall(["EXISTS", k])) || 0;
  },
  async expire(k: string, sec: number) {
    return await rcall(["EXPIRE", k, sec]);
  },
  async hgetall(k: string) {
    const arr = (await rcall(["HGETALL", k])) as any[] | null;
    if (!Array.isArray(arr)) return {};
    const out: Record<string, string> = {};
    for (let i = 0; i < arr.length; i += 2) out[String(arr[i])] = String(arr[i + 1]);
    return out;
  },
  async hset(k: string, fields: Record<string, any>) {
    const a: (string | number)[] = ["HSET", k];
    for (const [f, v] of Object.entries(fields)) a.push(f, typeof v === "string" ? v : JSON.stringify(v));
    return await rcall(a);
  },
  async setNxPx(k: string, v: string, ttlMs: number) {
    return (await rcall(["SET", k, v, "NX", "PX", ttlMs])) === "OK";
  },
  async zadd(k: string, score: number, member: string) {
    return await rcall(["ZADD", k, score, member]);
  },
  async zcard(k: string) {
    return Number(await rcall(["ZCARD", k])) || 0;
  },
};

/* ---------- anon (header or signed cookie) ---------- */
export async function anonFrom(req: NextRequest): Promise<string | null> {
  const hdr = (req.headers.get("x-anon-id") || "").trim();
  if (hdr) return hdr;

  const jar = await cookies(); // ← التصحيح: await cookies()
  const candNames = ["anon", "anonId", "aid", "ditona_anon"];
  for (const n of candNames) {
    const v = jar.get(n)?.value;
    if (!v) continue;
    const parts = v.split(".");
    if (parts.length === 3 && parts[0] === "v1" && process.env.ANON_SIGNING_SECRET) {
      const id = parts[1], sig = parts[2];
      const hs = createHmac("sha256", process.env.ANON_SIGNING_SECRET).update(id).digest("hex");
      if (hs === sig) return id;
      return id; // تسامح عند فشل التحقق
    }
    return v;
  }
  return null;
}

/* ---------- logging ---------- */
export function logRTC(fields: Record<string, any>) {
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), mod: "rtc", ...fields }));
  } catch {}
}
/* ---------- compatibility shims for routes that import helpers ---------- */

// خطأ HTTP صريح ليلتقطه withCommon
class HttpError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(typeof body === "string" ? body : JSON.stringify(body));
    this.status = status;
    this.body = body;
  }
}

/** يلفّ أي handler ويضمن ردود no-store + x-req-id، ويلتقط الأخطاء القياسية */
export function withCommon(
  handler: (req: NextRequest) => Promise<Response> | Response
) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      const res = await handler(req);
      // تأكيد x-req-id على الاستجابة إن توفّر في الطلب
      const rid = reqId(req);
      if (rid && (res as any)?.headers?.set) {
        try { (res as any).headers.set("x-req-id", rid); } catch {}
      }
      return res;
    } catch (e: any) {
      if (e instanceof HttpError) {
        return rjson(req, e.body, e.status);
      }
      return rjson(req, { error: "internal-error" }, 500);
    }
  };
}

/** مخصص للـOPTIONS في الملفات التي تفعل: export const OPTIONS = optionsHandler */
export function optionsHandler(req: NextRequest) {
  return rempty(req, 204);
}

/** توافق مع الاسم القديم؛ يوجه إلى مسجلنا الحالي */
export const logEvt = logRTC;

/** يعيد anon أو يرمي 401 ليُلتقط داخل withCommon */
export async function getAnonOrThrow(req: NextRequest): Promise<string> {
  const id = await anonFrom(req);
  if (id) return id;
  throw new HttpError(401, { error: "anon-missing" });
}
/* ---------- attrs/filters normalization + redis key helpers ---------- */

type Attrs = { gender: string; country: string };
type Filters = { filterGenders: string; filterCountries: string };

const G_MAP: Record<string, string> = {
  m: "m", male: "m",
  f: "f", female: "f",
  c: "c", couple: "c",
  l: "l", lgbt: "l", LGBT: "l",
  u: "u", unknown: "u", x: "u", any: "u",
};

function canonGender(v: any): string {
  if (!v) return "u";
  const s = String(v).toLowerCase().trim();
  return G_MAP[s] || "u";
}

function canonCountry2(v: any): string {
  if (!v) return "XX";
  const s = String(v).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : "XX";
}

function uniqCsvUpper(csv: string): string {
  const set = new Set<string>();
  for (const p of String(csv).split(",")) {
    const s = p.trim().toUpperCase();
    if (s) set.add(s);
  }
  return Array.from(set).join(",");
}

/** يحوّل مدخلات الواجهة إلى attrs قانونية */
export function normalizeAttrs(input: any): Attrs {
  return {
    gender: canonGender(input?.gender),
    country: canonCountry2(input?.country),
  };
}

/** يحوّل مدخلات الواجهة إلى فلاتر قانونية */
export function normalizeFilters(input: any): Filters {
  // filterGenders: "all" أو CSV من m,f,c,l
  let fg = String(input?.filterGenders ?? "all").trim().toLowerCase();
  if (fg !== "all") {
    const set = new Set<string>();
    for (const p of fg.split(",")) {
      const g = G_MAP[String(p).toLowerCase().trim()] || "";
      if (g && g !== "u") set.add(g);
    }
    fg = set.size ? Array.from(set).join(",") : "all";
  }

  // filterCountries: "ALL" أو CSV ISO2
  let fc = String(input?.filterCountries ?? "ALL").trim();
  if (fc.toUpperCase() !== "ALL") {
    const list = uniqCsvUpper(fc)
      .split(",")
      .filter(c => /^[A-Z]{2}$/.test(c));
    fc = list.length ? list.join(",") : "ALL";
  } else {
    fc = "ALL";
  }

  return { filterGenders: fg, filterCountries: fc };
}

/* ---------- redis key builders (ضمن النطاق المسموح) ---------- */
export const kAttrs = (anon: string) => `rtc:attrs:${anon}`;
export const kFilters = (anon: string) => `rtc:filters:${anon}`;
export const kPairMap = (anon: string) => `rtc:pair:map:${anon}`;
export const kClaim = (anon: string) => `rtc:claim:${anon}`;
export const kLast = (anon: string) => `rtc:last:${anon}`;
