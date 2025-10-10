import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ensureAnonCookie, rjson, hNoStore } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

export async function GET(req: NextRequest) {
  await cookies();
  const anonId = await ensureAnonCookie(req); // إنشاء فقط إن كان مفقودًا
  return rjson(req, { ok: true, anonId }, 200);
}
