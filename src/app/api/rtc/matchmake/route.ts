import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { matchmake, pairMapOf } from "@/lib/rtc/mm";
export const runtime = "nodejs";

async function upstashGetMeta(anonId:string){
  try{
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if(!url||!token||!anonId) return null;
    const key = `rtc:user:${anonId}`;
    const r = await fetch(url, {
      method:'POST',
      headers:{'content-type':'application/json','authorization':`Bearer ${token}`},
      body: JSON.stringify([["HGET", key, "meta"]]),
      cache:'no-store'
    }).catch(()=>null);
    const j = r? await r.json().catch(()=>null) : null;
    const raw = Array.isArray(j?.result) ? j.result[0] : j?.result;
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}

export async function POST(
_req: NextRequest) {
  const anon = extractAnonId(_req);
  if (!anon) return NextResponse.json({ error:"anon-required" }, { status:403 });
  const mapped = await pairMapOf(anon);
  if (mapped) return NextResponse.json({ found:true, pairId:mapped.pairId, role:mapped.role }, { status:200 });
  const res = await matchmake(anon);
  
if (res.status === 200) {
  const body:any = res.body || {};
  try{
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token && body.peerAnonId){
      const key = `rtc:attrs:${body.peerAnonId}`;
      const r = await fetch(url, {
        method:"POST",
        headers:{ "content-type":"application/json", "authorization":`Bearer ${token}` },
        body: JSON.stringify([["HGETALL", key]]),
        cache:"no-store"
      });
      const j:any = await r.json().catch(()=>null);
      const arr:any = j?.[0]?.result;
      let map:any = null;
      if (Array.isArray(arr)) { map = {}; for (let i=0;i<arr.length;i+=2) map[arr[i]] = arr[i+1]; }
      else if (arr && typeof arr==="object") { map = arr; }
      if (map) body.peerMeta = { country: map.country ?? null, gender: map.gender ?? null };
    }
  }catch{}
  return NextResponse.json(body, { status:200 });
}

  if (res.status === 204) return new NextResponse(null, { status:204 });
  return NextResponse.json(res.body || { error:"mm-fail" }, { status: res.status || 500 });
}
