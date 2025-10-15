// src/app/api/match/enqueue/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { enqueue, haveRedisEnv, EnqueueBody } from "@/lib/match/redis";

function hNoStore(req: NextRequest, extra?: Record<string, string>) {
  const h: Record<string, string> = {
    "cache-control": "no-store, max-age=0",
    "x-req-id-echo": req.headers.get("x-req-id") || "",
  };
  if (extra) Object.assign(h, extra);
  return h;
}

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new NextResponse(null, { status: 204, headers: hNoStore(req) });
}

export async function POST(req: NextRequest) {
  await cookies();

  if (!haveRedisEnv()) {
    return NextResponse.json(
      {
        error: "redis env missing",
        hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      },
      { status: 500, headers: hNoStore(req) },
    );
  }

  const j = (await req.json().catch(() => ({}))) as Partial<EnqueueBody> & { ticket?: string };

  const identity = String(j.identity || "");
  const deviceId = String(j.deviceId || "");
  if (!identity || !deviceId) {
    return NextResponse.json(
      { error: "identity/deviceId required" },
      { status: 400, headers: hNoStore(req) },
    );
  }

  const body: EnqueueBody = {
    identity,
    deviceId,
    vip: !!j.vip,
    selfGender: j.selfGender === "male" || j.selfGender === "female" ? j.selfGender : "u",
    selfCountry:
      typeof j.selfCountry === "string" && j.selfCountry.length === 2
        ? j.selfCountry.toUpperCase()
        : null,
    filterGenders:
      j.filterGenders === "male" || j.filterGenders === "female" ? j.filterGenders : "all",
    filterCountries: Array.isArray(j.filterCountries)
      ? j.filterCountries.map((c) => String(c).toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c))
      : [],
  };

  // enqueue() تُرجع string مباشرة
  const ticket = await enqueue(body, j.ticket);
  return NextResponse.json({ ticket }, { headers: hNoStore(req) });
}
