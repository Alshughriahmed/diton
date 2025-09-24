export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;






import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { get, setNxPx, expire } from "@/lib/rtc/upstash";
async function auth(anon: string, pairId: string){ const map = await get(`rtc:pair:map:${anon}`); if (!map) return null; const [pid, role] = String(map).split("|"); return pid===pairId ? role : null; }
export async function POST(req: NextRequest){
  const anon = extractAnonId(req); if (!anon) return NextResponse.json({ error:"anon-required" },{status:403});
  const { pairId, sdp } = await req.json().catch(()=>({})); if (!pairId || !sdp) return NextResponse.json({ error:"bad-input" },{status:400});
  const role = await auth(anon, pairId); if (role!=="caller") return NextResponse.json({ error:"only-caller" },{status:403});
  const ok = await setNxPx(`rtc:pair:${pairId}:offer`, String(sdp), 120_000); if (!ok) return NextResponse.json({ error:"exists" },{status:409});
  await expire(`rtc:pair:${pairId}`, 150); return new NextResponse(null,{status:204});
}
export async function GET(req: NextRequest){
  const anon = extractAnonId(req); if (!anon) return NextResponse.json({ error:"anon-required" },{status:403});
  const pairId = String(new URL(req.url).searchParams.get("pairId")||""); if (!pairId) return NextResponse.json({ error:"bad-input" },{status:400});
  const role = await auth(anon, pairId); if (role!=="callee") return NextResponse.json({ error:"only-callee" },{status:403});
  const sdp = await get(`rtc:pair:${pairId}:offer`); if (!sdp) return new NextResponse(null,{status:204});
  await expire(`rtc:pair:${pairId}`, 150); return NextResponse.json({ sdp:String(sdp) },{status:200});
}
