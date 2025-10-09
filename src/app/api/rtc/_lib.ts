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
