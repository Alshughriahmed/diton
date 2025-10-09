// src/app/api/health/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

function rid(req: NextRequest): string {
  const h = req.headers.get("x-req-id");
  // @ts-ignore crypto exists in node runtime
  return h || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function json(req: NextRequest, body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "x-req-id": rid(req) },
  });
}

export async function GET(req: NextRequest) {
  return json(req, { ok: true, ts: Date.now(), env: "health" });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "x-req-id": rid(req) },
  });
}
