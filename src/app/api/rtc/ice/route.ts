export const preferredRegion = ["fra1","iad1"];
const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { get, lpush, lrange, ltrim, expire } from "@/lib/rtc/upstash";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }

// Feature flag + window
const ICE_GRACE = (process.env.ICE_GRACE ?? "0") === "1";
const ICE_GRACE_MS = Number(process.env.ICE_GRACE_MS ?? "5000");

async function auth(anon: string, pairId: string) {
  const map = await get(`rtc:pair:map:${anon}`); if (!map) return null;
  const [pid, role] = String(map).split("|"); if (pid !== pairId) return null;
  return role as "caller" | "callee";
}

export async function POST(req: NextRequest) {
  try {
    const anon = extractAnonId(req);
    if (!anon) return __noStore(NextResponse.json({ error: "anon-required" }, { status: 403 }));

    const { pairId, candidate } = await req.json().catch(() => ({}));
    if (!pairId || !candidate) return __noStore(NextResponse.json({ error: "bad-input" }, { status: 400 }));

    const role = await auth(anon, pairId);

    // ICE grace: 204 بدلاً من 403 خلال ≤ ICE_GRACE_MS لنفس المستخدم
    if (!role) {
      const hdrAnon = (req.headers.get("x-anon-id") || "").trim();
      const last = Number(req.headers.get("x-last-stop-ts") || "0");
      const within = last > 0 && (Date.now() - last) <= ICE_GRACE_MS;
      if (ICE_GRACE && hdrAnon && hdrAnon === anon && within) {
        return __withNoStore(new NextResponse(null, { status: 204 }));
      }
      return __noStore(NextResponse.json({ error: "forbidden" }, { status: 403 }));
    }

    const dest = role === "caller" ? "b" : "a";
    const key = `rtc:pair:${pairId}:ice:${dest}`;
    await lpush(key, JSON.stringify({ from: role === "caller" ? "a" : "b", cand: candidate }));
    await expire(key, 150);
    await expire(`rtc:pair:${pairId}`, 150);
    return __withNoStore(new NextResponse(null, { status: 204 }));
  } catch (e: any) {
    return __noStore(NextResponse.json({ error: "ice-post-fail", info: String(e?.message || e).slice(0, 140) }, { status: 500 }));
  }
}

export async function GET(req: NextRequest) {
  const anon = extractAnonId(req); if (!anon) return __noStore(NextResponse.json({ error: "anon-required" }, { status: 403 }));
  const pairId = String(new URL(req.url).searchParams.get("pairId") || ""); if (!pairId) return __noStore(NextResponse.json({ error: "bad-input" }, { status: 400 }));

  const role = await auth(anon, pairId); if (!role) return __noStore(NextResponse.json({ error: "forbidden" }, { status: 403 }));
  const me = role === "caller" ? "a" : "b";
  const key = `rtc:pair:${pairId}:ice:${me}`;

  const items = await lrange(key, 0, 49);
  if (!items || items.length === 0) return __withNoStore(new NextResponse(null, { status: 204 }));

  await ltrim(key, items.length, -1);
  await expire(`rtc:pair:${pairId}`, 150);
  return __withNoStore(NextResponse.json(items.map(s => JSON.parse(s)), { status: 200 }));
}
