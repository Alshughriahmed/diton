import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// minimal local helper: echo x-req-id + set no-store
function withReqId(res: NextResponse, req: Request) {
  const id =
    req.headers.get("x-req-id") ||
    (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
  try {
    res.headers.set("x-req-id", id);
    if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
    if (!res.headers.has("Referrer-Policy")) res.headers.set("Referrer-Policy", "no-referrer");
  } catch {}
  return res;
}

export async function GET(req: Request) {
  return withReqId(new NextResponse("ok", { status: 200 }), req);
}

export async function OPTIONS(req: Request) {
  return withReqId(new NextResponse(null, { status: 204 }), req);
}
