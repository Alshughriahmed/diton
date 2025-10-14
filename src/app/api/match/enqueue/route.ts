export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { enqueue, haveRedisEnv } from "@/lib/match/redis";

function hNoStore(req: NextRequest, extra?: Record<string,string>) {
  const h: Record<string,string> = {
    "cache-control": "no-store, max-age=0",
    "x-req-id-echo": req.headers.get("x-req-id") || "",
    "content-type": "application/json; charset=utf-8",
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
  try {
    if (!haveRedisEnv()) {
      return new NextResponse(JSON.stringify({ error: "redis env missing", hasUrl: !!process.env.UPSTASH_REDIS_REST_URL, hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN }), { status: 500, headers: hNoStore(req) });
    }
    const j = await req.json().catch(()=> ({} as any));
    const identity = String(j?.identity || "");
    const deviceId = String(j?.deviceId || "");
    if (!identity || !deviceId) {
      return new NextResponse(JSON.stringify({ error: "identity/deviceId required" }), { status: 400, headers: hNoStore(req) });
    }
    const vip = !!j?.vip;
    const selfGender = (j?.selfGender === "male" || j?.selfGender === "female") ? j.selfGender : "u";
    const selfCountry = (typeof j?.selfCountry === "string" && j.selfCountry.length === 2) ? j.selfCountry.toUpperCase() : null;
    const filterGenders = (j?.filterGenders === "male" || j?.filterGenders === "female") ? j.filterGenders : "all";
    const filterCountries = Array.isArray(j?.filterCountries)
      ? j.filterCountries.map((x:string)=>String(x).toUpperCase()).filter((x:string)=>/^[A-Z]{2}$/.test(x))
      : [];

    const { ticket } = await enqueue({ identity, deviceId, vip, selfGender, selfCountry, filterGenders, filterCountries });
    return new NextResponse(JSON.stringify({ ticket }), { status: 200, headers: hNoStore(req) });
  } catch (e:any) {
    const msg = typeof e?.message === "string" ? e.message : "internal";
    return new NextResponse(JSON.stringify({ error: msg }), { status: 500, headers: hNoStore(req) });
  }
}
