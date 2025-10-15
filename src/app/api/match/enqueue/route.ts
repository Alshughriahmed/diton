// src/app/api/match/enqueue/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { enqueue, haveRedisEnv } from "@/lib/match/redis";

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

const GENDERS = new Set(["male", "female", "couples", "lgbt", "all"]);

export async function POST(req: NextRequest) {
  await cookies();

  if (!haveRedisEnv()) {
    return new NextResponse(
      JSON.stringify({ error: "redis env missing" }),
      { status: 500, headers: hNoStore(req, { "content-type": "application/json" }) }
    );
  }

  try {
    const j = await req.json().catch(() => ({} as any));

    const identity = String(j?.identity || "");
    const deviceId = String(j?.deviceId || "");
    const vip = !!j?.vip;

    const sGenderRaw = String(j?.selfGender || "").toLowerCase();
    const selfGender =
      GENDERS.has(sGenderRaw) && sGenderRaw !== "all" ? (sGenderRaw as any) : "u";

    const selfCountry =
      typeof j?.selfCountry === "string" && j.selfCountry.length === 2
        ? j.selfCountry.toUpperCase()
        : null;

    const fGenderRaw = String(j?.filterGenders || "all").toLowerCase();
    const filterGenders = GENDERS.has(fGenderRaw) ? (fGenderRaw as any) : "all";

    const filterCountries: string[] = Array.isArray(j?.filterCountries)
      ? j.filterCountries.map((x: string) => String(x).toUpperCase()).filter(Boolean)
      : String(j?.filterCountries || "")
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter((x) => x.length === 2);

    if (!identity || !deviceId) {
      return new NextResponse(
        JSON.stringify({ error: "identity/deviceId required" }),
        { status: 400, headers: hNoStore(req, { "content-type": "application/json" }) }
      );
    }

    const { ticket } = await enqueue({
      identity,
      deviceId,
      vip,
      selfGender,        // "male" | "female" | "couples" | "lgbt" | "u"
      selfCountry,       // "DE" | null
      filterGenders,     // "all" | "male" | "female" | "couples" | "lgbt"
      filterCountries,   // string[]
    });

    return new NextResponse(JSON.stringify({ ticket }), {
      status: 200,
      headers: hNoStore(req, { "content-type": "application/json" }),
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "internal";
    return new NextResponse(JSON.stringify({ error: msg }), {
      status: 500,
      headers: hNoStore(req, { "content-type": "application/json" }),
    });
  }
}
