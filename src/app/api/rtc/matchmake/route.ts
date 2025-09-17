import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { matchmake, pairMapOf } from "@/lib/rtc/mm";
import { setPx } from "@/lib/rtc/upstash";
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
  if (!anon) return NextResponse.json({ error:"anon-required" }, { status:401 });
  let prevFor:string|null=null;
  try{
    if(_req.headers.get("content-type")?.includes("application/json")){
      const b:any = await _req.json().catch(()=>null);
      prevFor = b?.prevFor || null;
    } else {
      prevFor = _req.nextUrl?.searchParams?.get("prevFor") || null;
    }
  }catch{}
  if (prevFor) { try{ await setPx(`rtc:prev-wish:${anon}`, String(prevFor), 7000); }catch{} }

  const mapped = await pairMapOf(anon);
  if (mapped) {
    // Fetch peer info from the pair record
    let peerAnonId = null;
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (url && token) {
        const endpoint = url.endsWith('/pipeline') ? url : `${url}/pipeline`;
        const pairKey = `rtc:pair:${mapped.pairId}`;
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
          body: JSON.stringify([["HGET", pairKey, "a"], ["HGET", pairKey, "b"]]),
          cache: "no-store"
        });
        const jr: any = await r.json().catch(() => null);
        const arr = Array.isArray(jr?.result) ? jr.result : (Array.isArray(jr) ? jr : []);
        const userA = arr[0]?.result ?? null;
        const userB = arr[1]?.result ?? null;
        
        // Determine peer based on role
        if (mapped.role === "caller") {
          peerAnonId = userB;
        } else {
          peerAnonId = userA;
        }
        
        // Fallback: try to get from rtc:last if pair fetch failed
        if (!peerAnonId) {
          const lastKey = `rtc:last:${anon}`;
          const lr = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
            body: JSON.stringify([["GET", lastKey]]),
            cache: "no-store"
          });
          const lj: any = await lr.json().catch(() => null);
          const lastArr = Array.isArray(lj?.result) ? lj.result : (Array.isArray(lj) ? lj : []);
          peerAnonId = lastArr[0]?.result ?? null;
        }
      }
    } catch {}
    
    return NextResponse.json({ 
      found: true, 
      pairId: mapped.pairId, 
      role: mapped.role,
      peerAnonId: peerAnonId || "" 
    }, { status: 200 });
  }
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
      let map: any = null;
      if (Array.isArray(arr)) { map = {}; for (let i=0;i<arr.length;i+=2) map[arr[i]] = arr[i+1]; }
      else if (arr && typeof arr==="object") { map = arr; }
      if (map) body.peerMeta = { country: map.country ?? null, gender: map.gender ?? null };
    }
  }catch{}
  try{
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token && body.peerAnonId){
      // (أ) القراءة الحالية لـ peerMeta تبقى كما هي
      {
        const key = `rtc:attrs:${body.peerAnonId}`;
        const r = await fetch(url, {
          method:"POST",
          headers:{ "content-type":"application/json", "authorization":`Bearer ${token}` },
          body: JSON.stringify([["HGETALL", key]]),
          cache:"no-store"
        });
        const j=await r.json().catch(()=>null);
        const arr=j?.[0]?.result;
        let map: any = null;
        if (Array.isArray(arr)) { map={}; for (let i=0;i<arr.length;i+=2) map[arr[i]]=arr[i+1]; }
        else if (arr && typeof arr==="object") { map=arr; }
        if (map) body.peerMeta = { country: map.country ?? null, gender: map.gender ?? null };
      }
      // (ب) كتابة مفاتيح last لكلا الطرفين (TTL ~ 90s)
      try{
        const setBody = JSON.stringify([
          ["SET", `rtc:last:${anon}`, body.peerAnonId, "PX", "90000"],
          ["SET", `rtc:last:${body.peerAnonId}`, anon, "PX", "90000"]
        ]);
        await fetch(url + "/pipeline", {
          method:"POST",
          headers:{ "content-type":"application/json", "authorization":`Bearer ${token}` },
          body: setBody, cache:"no-store"
        });
      }catch{}
    }
  }catch{}

  return NextResponse.json(body, { status: 200 });
}

  if (res.status === 204) return new NextResponse(null, { status:204 });
  return NextResponse.json(res.body || { error:"mm-fail" }, { status: res.status || 500 });
}
