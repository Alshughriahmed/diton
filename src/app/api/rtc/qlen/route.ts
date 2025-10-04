import { jsonEcho } from "@/lib/api/xreq";
import { withReqId } from "@/lib/http/withReqId";
import { getQueueStats } from "@/lib/rtc/queue";

const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];







import { NextResponse } from "next/server";
import { zcard, zremrangebyscore, MODE } from "@/lib/rtc/upstash";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }

export async function GET(req: Request) {
  try {
    const stats = await getQueueStats();
    
    // Legacy compatibility: also return old 'len' field
    const cutoff = Date.now() - 60_000;
    await zremrangebyscore(`rtc:q`, "-inf", `(${cutoff}`);
    const len = await zcard(`rtc:q`);
    
    return __noStore(jsonEcho(req, { 
      mode: MODE, 
      len: Number(len || 0),
      wait: stats.wait,
      pairs: stats.pairs 
    }, { status: 200 }));
  } catch (e: any) {
    return __noStore(jsonEcho(req, { 
      mode: MODE === "redis" ? "redis-fail" : "memory", 
      len: 0, 
      wait: 0,
      pairs: 0,
      error: String(e?.message||e).slice(0,120) 
    }, { status: 200 }));
  }
}
