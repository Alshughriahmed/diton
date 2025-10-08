import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const H = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
} as const;

function withReqId(res: NextResponse, req?: Request): NextResponse {
  try {
    const incoming = req?.headers?.get("x-req-id") ?? "";
    const id =
      incoming || (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    res.headers.set("x-req-id", id);
    if (!res.headers.has("cache-control")) res.headers.set("cache-control", "no-store");
    if (!res.headers.has("referrer-policy")) res.headers.set("referrer-policy", "no-referrer");
  } catch {}
  return res;
}

export async function GET(req: Request) {
  return withReqId(NextResponse.json({ ok: true }, { headers: H }), req);
}

export async function OPTIONS(req: Request) {
  return withReqId(new NextResponse(null, { status: 204, headers: H }), req);
}
