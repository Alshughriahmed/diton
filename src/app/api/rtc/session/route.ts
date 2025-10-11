import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { hNoStore, anonFrom, rjson } from "../_lib";

export const preferredRegion = ["fra1","iad1"];
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

export async function GET(req: NextRequest) {
  await cookies();
  const anon = await anonFrom(req);
  if (!anon) {
    return new Response(JSON.stringify({ error: "anon-required" }), {
      status: 403,
      headers: hNoStore(req),
    });
  }

  return new Response(JSON.stringify({ ok: true, anonId: anon }), {
    status: 200,
    headers: hNoStore(req),
  });
}

export async function POST(req: NextRequest) {
  // اختياري: نفس GET
  return GET(req);
}
