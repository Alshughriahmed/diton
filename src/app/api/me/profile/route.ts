// src/app/api/me/profile/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const REDIS_HEADERS = { Authorization: `Bearer ${UPSTASH_TOKEN}` };

const keyOf = (uid: string) => `user:profile:${uid}`;

async function redisGet(key: string) {
  const r = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    method: "GET",
    headers: REDIS_HEADERS,
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return j?.result ?? null;
}

async function redisSet(key: string, value: string) {
  await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: REDIS_HEADERS,
  }).catch(() => {});
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uid = (searchParams.get("uid") || "").trim();
  if (!uid) return noStore(NextResponse.json({ error: "uid required" }, { status: 400 }));
  try {
    const raw = await redisGet(keyOf(uid));
    const profile = raw ? JSON.parse(String(raw)) : null;
    return noStore(NextResponse.json({ ok: true, profile }, { status: 200 }));
  } catch {
    return noStore(NextResponse.json({ ok: false }, { status: 500 }));
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as any;
    const uid = String(body?.uid || "").trim();
    const profile = body?.profile ?? null;
    if (!uid || typeof profile !== "object") {
      return noStore(NextResponse.json({ error: "uid and profile required" }, { status: 400 }));
    }
    await redisSet(keyOf(uid), JSON.stringify(profile));
    return noStore(NextResponse.json({ ok: true }, { status: 200 }));
  } catch {
    return noStore(NextResponse.json({ ok: false }, { status: 500 }));
  }
}
