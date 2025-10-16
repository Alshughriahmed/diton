// src/app/api/regions/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

const REGIONS = [
  { code: "US", name: "United States" },
  { code: "DE", name: "Germany" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "TR", name: "Türkiye" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "EG", name: "Egypt" },
];

export async function GET() {
  return new NextResponse(JSON.stringify({ ok: true, regions: REGIONS }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
