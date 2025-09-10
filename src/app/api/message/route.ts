import { NextRequest, NextResponse } from "next/server";

// In-memory storage for demo (replace with Redis/database)
const COUNTS = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "local";
    const { txt } = await req.json();
    
    if (!txt || typeof txt !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }
    
    // FREE_FOR_ALL mode bypasses guest limits
    const freeForAll = process.env.NEXT_PUBLIC_FREE_FOR_ALL === "1";
    if (freeForAll) {
      return NextResponse.json({ ok: true, n: 1, remaining: 999, freeMode: true });
    }
    
    const n = (COUNTS.get(ip) || 0) + 1;
    COUNTS.set(ip, n);
    
    if (n > 10) {
      return NextResponse.json({ error: "guest limit" }, { status: 429 });
    }
    
    return NextResponse.json({ ok: true, n, remaining: 10 - n });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "local";
  const count = COUNTS.get(ip) || 0;
  return NextResponse.json({ count, remaining: Math.max(0, 10 - count) });
}