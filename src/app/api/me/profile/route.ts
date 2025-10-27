// src/app/api/me/profile/route.ts
import { NextResponse } from "next/server";
import { redis } from "@/lib/redisClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

const keyOf = (uid: string) => `user:profile:${uid}`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uid = (searchParams.get("uid") || "").trim();
  if (!uid) return noStore(NextResponse.json({ error: "uid required" }, { status: 400 }));
  try {
    const raw = await redis.get(keyOf(uid));
    const profile = raw ? JSON.parse(String(raw)) : null;
    return noStore(NextResponse.json({ ok: true, profile }, { status: 200 }));
  } catch (e) {
    return noStore(NextResponse.json({ ok: false }, { status: 500 }));
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as any;
    const uid = String(body?.uid || "").trim();
    const profile = body?.profile ?? null;
    if (!uid || typeof profile !== "object") {
      return noStore(NextResponse.json({ error: "uid and profile required" }, { status: 400 }));
    }
    await redis.set(keyOf(uid), JSON.stringify(profile));
    return noStore(NextResponse.json({ ok: true }, { status: 200 }));
  } catch {
    return noStore(NextResponse.json({ ok: false }, { status: 500 }));
  }
}
