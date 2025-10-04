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
import { matchmake, pairMapOf } from "@/lib/rtc/mm";
import { setPx } from "@/lib/rtc/upstash";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }


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
req: NextRequest) {
  const start = Date.now();
  const reqId = req.headers.get("x-req-id") || crypto.randomUUID();
  
  // Trigger cleanup on every matchmake
  cleanupGhosts().catch(() => {});
  
  const cookieStore = await cookies();
  const headerStore = await headers();
  const raw =
    cookieStore.get("anon")?.value ??
    headerStore.get("cookie")?.match(/(?:^|;\s*)anon=([^;]+)/)?.[1] ??
    null;

  const anonId = raw ? verifySigned(raw, process.env.ANON_SIGNING_SECRET!) : null;
  if (!anonId) {
    logRTC({ route: "/api/rtc/matchmake", reqId, ms: Date.now() - start, status: 401, note: "no-anon" });
    return __noStore(jsonEcho(req, { error: "anon-required" }, { status: 401, headers: { "cache-control": "no-store" } }));
  }
  let prevFor:string|null=null;
  let filters: {gender?: string, countries?: string[]} = {};
  
  try{
    if(req.headers.get("content-type")?.includes("application/json")){
      const b:any = await req.json().catch(()=>null);
      prevFor = b?.prevFor || null;
      
      // Extract filter parameters
      if (b?.gender && b.gender !== 'all') {
        filters.gender = String(b.gender);
      }
      if (b?.countries && Array.isArray(b.countries) && b.countries.length > 0) {
        filters.countries = b.countries.filter((c: any) => c && c !== 'ALL').slice(0, 15);
      }
    } else {
      prevFor = req.nextUrl?.searchParams?.get("prevFor") || null;
    }
  }catch{}
  
  if (prevFor) { try{ await setPx(`rtc:prev-wish:${anonId}`, String(prevFor), 7000); }catch{} }

  // Update user's filters and attributes in queue if filters provided
  if (filters.gender || filters.countries) {
    try {
      const { enqueue } = await import('@/lib/rtc/mm');
      
      // Default attrs (will be improved with real user data later)
      const attrs = {
        gender: 'unknown', // TODO: get from user profile
        country: 'UNKNOWN' // TODO: get from geo or user profile
      };
      
      // Prepare filters for enqueue
      const enqueueFilt = {
        genders: filters.gender || 'all',
        countries: filters.countries?.length ? filters.countries.join(',') : 'ALL'
      };
      
      // Update queue with new filters
      await enqueue(anonId, attrs, enqueueFilt);
    } catch (error) {
      console.warn('[matchmake] Failed to update filters:', error);
    }
  }

  const mapped = await pairMapOf(anonId);
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
          const lastKey = `rtc:last:${anonId}`;
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
    
    return __noStore(jsonEcho(req, { 
      found: true, 
      pairId: mapped.pairId, 
      role: mapped.role,
      peerAnonId: peerAnonId || "" 
    }, { status: 200 }));;
  }
  // Call matchmake with updated filters context 
  const res = await matchmake(anonId);
  
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
      const arr:any = j?.result;
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
      // Set last connection records for both users (TTL ~ 90s)
      try{
        const setBody = JSON.stringify([
          ["SET", `rtc:last:${anonId}`, body.peerAnonId, "PX", "90000"],
          ["SET", `rtc:last:${body.peerAnonId}`, anonId, "PX", "90000"]
        ]);
        await fetch(url + "/pipeline", {
          method:"POST",
          headers:{ "content-type":"application/json", "authorization":`Bearer ${token}` },
          body: setBody, cache:"no-store"
        });
      }catch{}
    }
  }catch{}

  logRTC({ route: "/api/rtc/matchmake", reqId, ms: Date.now() - start, status: 200, note: "matched" });
  return __noStore(jsonEcho(req, body, { status: 200 }));
}

  if (res.status === 204) {
    logRTC({ route: "/api/rtc/matchmake", reqId, ms: Date.now() - start, status: 204, note: "no-match" });
    return __noStore(new NextResponse(null, { status:204 }));
  }
  
  logRTC({ route: "/api/rtc/matchmake", reqId, ms: Date.now() - start, status: res.status || 500, note: "mm-fail" });
  return __noStore(jsonEcho(req, res.body || { error:"mm-fail" }, { status: res.status || 500 }));
}
