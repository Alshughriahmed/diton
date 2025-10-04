const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;






import { NextRequest, NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";
import { extractAnonId } from "@/lib/rtc/auth";
import { hgetall, expire } from "@/lib/rtc/upstash";
import { touchQueue } from "@/lib/rtc/mm";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }

export async function GET(_req: NextRequest){
  const anon = extractAnonId(_req); if (!anon) return withReqId(__noStore(NextResponse.json({ ok:false },{status:403})));;
  const attr = await hgetall(`rtc:attrs:${anon}`);
  if (attr?.gender && attr?.country) {
    await touchQueue(anon, { gender: attr.gender, country: attr.country });
    await Promise.all([ expire(`rtc:attrs:${anon}`,120), expire(`rtc:filters:${anon}`,120) ]);
  }
  return withReqId(__noStore(NextResponse.json({ ok:true },{status:200})));;
}
