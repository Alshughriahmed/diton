import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { enqueue } from "@/lib/rtc/mm";
export const runtime = "nodejs";

export async function OPTIONS() { return NextResponse.json({ ok: true }); }

export async function POST(req: NextRequest) {
  try {
    const anon = extractAnonId(req);
    if (!anon) return NextResponse.json({ error: "anon-required" }, { status: 403 });

    const b: any = await req.json().catch(() => ({}));
    const gender = String(b.gender || "u").toLowerCase();
    const country = String(b.country || req.headers.get("x-vercel-ip-country") || "XX").toUpperCase();
    const filterGenders = String(b.filterGenders || "all");
    const filterCountries = String(b.filterCountries || "ALL");

    await enqueue(anon, { gender, country }, { genders: filterGenders, countries: filterCountries });
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json({ error: "enqueue-fail", info: String(e?.message || e).slice(0, 140) }, { status: 500 });
  }
}