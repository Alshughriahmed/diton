// src/app/api/rtc/session/route.ts
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { rjson, hNoStore, logRTC } from "../_lib";
import { randomUUID } from "node:crypto";

export const preferredRegion = ["fra1","iad1"];
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "anon";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 يوم

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

export async function GET(req: NextRequest) {
  const jar = await cookies();
  let anon = jar.get(COOKIE_NAME)?.value;

  if (!anon) {
    anon = randomUUID();
    jar.set({
      name: COOKIE_NAME,
      value: anon,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: MAX_AGE,
    });
    logRTC({ route: "/api/rtc/session", status: 200, phase: "issued", anonId: anon });
  } else {
    logRTC({ route: "/api/rtc/session", status: 200, phase: "existing", anonId: anon });
  }
return new Response(JSON.stringify({ ok: true, anonId: anon }), {
  status: 200,
  headers: hNoStore(req),
});
