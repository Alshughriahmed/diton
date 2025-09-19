import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const anon = extractAnonId(req);
    if (!anon) {
      return NextResponse.json({ error: "anon-required" }, { status: 401 });
    }

    // Init route successfully verified auth
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ 
      error: "init-fail", 
      info: String(e?.message || e).slice(0, 140) 
    }, { status: 500 });
  }
}

// Also support GET method for flexibility
export async function GET(req: NextRequest) {
  try {
    const anon = extractAnonId(req);
    if (!anon) {
      return NextResponse.json({ error: "anon-required" }, { status: 401 });
    }

    // Init route successfully verified auth
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ 
      error: "init-fail", 
      info: String(e?.message || e).slice(0, 140) 
    }, { status: 500 });
  }
}