export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { verifySigned } from "@/lib/rtc/auth";
import { enqueue } from "@/lib/rtc/mm";
import { zadd } from "@/lib/rtc/upstash";
import { requireVip } from "@/utils/vip";

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
    const cookieStore = await cookies();
    const headerStore = await headers();
    const raw =
      cookieStore.get("anon")?.value ??
      headerStore.get("cookie")?.match(/(?:^|;\s*)anon=([^;]+)/)?.[1] ??
      null;

    const anonId = raw ? verifySigned(raw, process.env.ANON_SIGNING_SECRET!) : null;
    if (!anonId) {
      return NextResponse.json({ error: "anon-required" }, { status: 401, headers: { "cache-control": "no-store" } });
    }

    const b: any = await req.json().catch(() => ({}));
    const gender = String(b.gender || "u").toLowerCase();
    const country = String(b.country || req.headers.get("x-vercel-ip-country") || "XX").toUpperCase();
    const filterGenders = String(b.filterGenders || "all");
    const filterCountries = String(b.filterCountries || "ALL");

    await enqueue(anonId, { gender, country }, { genders: filterGenders, countries: filterCountries });
// VIP weight: bring vip to the front
try {
  const isVip = await requireVip();
  if (isVip) {
    const pri = Date.now() - 600000; // 10min earlier
    await Promise.all([
      zadd(`rtc:q`, pri, anonId),
      zadd(`rtc:q:gender:${gender.toLowerCase()}`, pri, anonId),
      zadd(`rtc:q:country:${country.toUpperCase()}`, pri, anonId),
    ]);
  }
} catch {}
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json({ error: "enqueue-fail", info: String(e?.message || e).slice(0, 140) }, { status: 500 });
  }
}
