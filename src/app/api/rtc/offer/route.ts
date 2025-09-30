const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;






import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { get, setNxPx, expire } from "@/lib/rtc/upstash";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }

async function auth(anon: string, pairId: string){ const map = await get(`rtc:pair:map:${anon}`); if (!map) return null; const [pid, role] = String(map).split("|"); return pid===pairId ? role : null; }
export async function POST(req: NextRequest){
  const anon = extractAnonId(req); if (!anon) return __noStore(NextResponse.json({ error:"anon-required" },{status:403}));
  const { pairId, sdp } = await req.json().catch(()=>({})); if (!pairId || !sdp) return __noStore(NextResponse.json({ error:"bad-input" },{status:400}));
  const role = await auth(anon, pairId); if (role!=="caller") return __noStore(NextResponse.json({ error:"only-caller" },{status:403}));
  const ok = await setNxPx(`rtc:pair:${pairId}:offer`, String(sdp), 120_000); if (!ok) return __noStore(NextResponse.json({ error:"exists" },{status:409}));
  await expire(`rtc:pair:${pairId}`, 150); return __noStore(new NextResponse(null,{status:204}));
}
export async function GET(req: NextRequest){
  const anon = extractAnonId(req); if (!anon) return __noStore(NextResponse.json({ error:"anon-required" },{status:403}));
  const pairId = String(new URL(req.url).searchParams.get("pairId")||""); if (!pairId) return __noStore(NextResponse.json({ error:"bad-input" },{status:400}));
  const role = await auth(anon, pairId); if (role!=="callee") return __noStore(NextResponse.json({ error:"only-callee" },{status:403}));
  const sdp = await get(`rtc:pair:${pairId}:offer`); if (!sdp) return __noStore(new NextResponse(null,{status:204}));
  await expire(`rtc:pair:${pairId}`, 150); return __noStore(NextResponse.json({ sdp:String(sdp) },{status:200}));
}
