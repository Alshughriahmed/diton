import { NextResponse } from "next/server";
import { qPush, qLen } from "@/lib/queue";
export const runtime = "nodejs";

export async function OPTIONS() { return NextResponse.json({ ok:true }); }

export async function POST(req: Request) {
  let anon = "";
  try { const b:any = await req.json(); anon = b?.anonId || b?.id || b?.user || ""; } catch {}
  if (!anon) {
    // generate lightweight anon id
    const ip = (req.headers.get("x-forwarded-for")||"").split(",")[0].trim();
    anon = `anon-${Date.now().toString(36)}-${Math.floor(Math.random()*1e6).toString(36)}-${(ip||"x").replace(/[^a-zA-Z0-9]/g,"").slice(0,8)}`;
  }
  await qPush(anon);
  const s = await qLen();
  return NextResponse.json({ ok:true, anonId: anon, ...s });
}
