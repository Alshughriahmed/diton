import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const id =
    req.headers.get("x-req-id") ??
    globalThis.crypto?.randomUUID?.() ??
    String(Date.now());

  const res = NextResponse.json({ ok: true, ts: Date.now() });
  res.headers.set("x-req-id", id);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function HEAD(req: NextRequest) {
  const id =
    req.headers.get("x-req-id") ??
    globalThis.crypto?.randomUUID?.() ??
    String(Date.now());

  const res = new NextResponse(null, { status: 204 });
  res.headers.set("x-req-id", id);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
