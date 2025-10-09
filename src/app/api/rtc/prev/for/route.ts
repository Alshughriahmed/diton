export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { R, rjson, rempty, hNoStore, anonFrom } from "../../_lib";

type PrevRecord = { peerAnonId: string; pairId: string; ts: number };

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

export async function GET(req: NextRequest) {
  await cookies();
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403);

  const s = await R.get(`rtc:prev-for:${anon}`);
  if (!s) return rempty(req, 204);

  let rec: PrevRecord | null = null;
  try { rec = JSON.parse(String(s)); } catch {}

  const ttl = Number(process.env.PREV_TTL_SEC || "60") * 1000;
  const tooOld = !rec?.ts || (Date.now() - rec.ts) > ttl;
  const selfMatch = !rec?.peerAnonId || rec.peerAnonId === anon;
  if (tooOld || selfMatch || !rec?.pairId) {
    await R.del(`rtc:prev-for:${anon}`);
    return rempty(req, 204);
  }

  await R.del(`rtc:prev-for:${anon}`); // one-shot
  return rjson(req, { ok: true, found: true, pairId: rec.pairId, peerAnonId: rec.peerAnonId }, 200);
}
