import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { enqueue } from "@/lib/rtc/mm";
import { zadd } from "@/lib/rtc/upstash";
import { requireVip } from "@/utils/vip";
export const runtime = "nodejs";

export async function OPTIONS() { return NextResponse.json({ ok: true }); }


async function upstashPipeline(cmds:any[]){
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token) return null;
  const r = await fetch(url, {
    method: 'POST',
    headers: {'content-type':'application/json','authorization':`Bearer ${token}`},
    body: JSON.stringify(cmds),
    cache:'no-store'
  }).catch(()=>null);
  return r ? await r.json().catch(()=>null) : null;
}
async function saveUserMetaUpstash(anonId:string, meta:any){
  try{
    if(!anonId) return;
    const key = `rtc:user:${anonId}`;
    const ttlMs = 120000;
    await upstashPipeline([
      ["HSET", key, "meta", JSON.stringify(meta||{})],
      ["PEXPIRE", key, String(ttlMs)]
    ]);
  }catch{}
}

export async function POST(
req: NextRequest) {
  try {
    const anon = extractAnonId(req);
    if (!anon) return NextResponse.json({ error: "anon-required" }, { status: 401 });

    const b: any = await req.json().catch(() => ({}));
    const gender = String(b.gender || "u").toLowerCase();
    const country = String(b.country || req.headers.get("x-vercel-ip-country") || "XX").toUpperCase();
    const filterGenders = String(b.filterGenders || "all");
    const filterCountries = String(b.filterCountries || "ALL");

    await enqueue(anon, { gender, country }, { genders: filterGenders, countries: filterCountries });
// VIP weight: bring vip to the front
try {
  const isVip = await requireVip();
  if (isVip) {
    const pri = Date.now() - 600000; // 10min earlier
    await Promise.all([
      zadd(`rtc:q`, pri, anon),
      zadd(`rtc:q:gender:${gender.toLowerCase()}`, pri, anon),
      zadd(`rtc:q:country:${country.toUpperCase()}`, pri, anon),
    ]);
  }
} catch {}
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json({ error: "enqueue-fail", info: String(e?.message || e).slice(0, 140) }, { status: 500 });
  }
}
export const dynamic="force-dynamic";
