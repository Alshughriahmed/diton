import { jsonEcho } from "@/lib/api/xreq";
import { logRTC } from "@/lib/rtc/logger";
import { cleanupGhosts } from "@/lib/rtc/queue";

const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];








import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { verifySigned } from "@/lib/rtc/auth";
import { enqueue } from "@/lib/rtc/mm";
import { zadd } from "@/lib/rtc/upstash";
import { requireVip } from "@/utils/vip";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }


export async function OPTIONS() {
  return __noStore(new NextResponse(null, { status: 204 }));
}

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
  const start = Date.now();
  const reqId = req.headers.get("x-req-id") || crypto.randomUUID();
  
  try {
    // Trigger cleanup on every enqueue
cleanupGhosts().catch(() => {});

const cookieStore = cookies();
const raw =
  cookieStore.get("anon")?.value ??
  req.headers.get("cookie")?.match(/(?:^|;\s*)anon=([^;]+)/)?.[1] ??
  null;

const anonId = raw ? verifySigned(raw, process.env.ANON_SIGNING_SECRET!) : null;
if (!anonId) {
  logRTC({ route: "/api/rtc/enqueue", reqId, ms: Date.now() - start, status: 403, note: "no-anon" });
  return __noStore(jsonEcho(req, { error: "anon-required" }, { status: 403 }));
}

const b: any = await req.json().catch(() => ({}));
const gender = String(b.gender ?? "u").toLowerCase();
const country = String(b.country ?? req.headers.get("x-vercel-ip-country") ?? "XX").toUpperCase();
const filterGenders = String(b.filterGenders ?? "all");
const filterCountries = String(b.filterCountries ?? "ALL");

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
    
    logRTC({ route: "/api/rtc/enqueue", reqId, ms: Date.now() - start, status: 204, note: "enqueued" });
    return __noStore(new NextResponse(null, { status: 204 }));
  } catch (e: any) {
    logRTC({ route: "/api/rtc/enqueue", reqId, ms: Date.now() - start, status: 500, note: String(e?.message || e).slice(0, 100) });
    return __noStore(jsonEcho(req, 
      { error: "enqueue-fail", info: String(e?.message || e).slice(0, 140) },
      { status: 500 }
    ));
  }
}
