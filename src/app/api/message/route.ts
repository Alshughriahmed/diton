import { NextResponse } from "next/server";
export const runtime = "nodejs";

const FREE = process.env.FREE_FOR_ALL === "1";
const MAX_GUEST = 10;

// naive in-memory fallback (per process). ok for MVP/stateless functions reset per instance.
const hits = new Map<string, { n:number; t:number }>();
function keyFrom(req: Request) {
  const f = (req.headers.get("x-forwarded-for")||"").split(",")[0].trim();
  const ua = req.headers.get("user-agent")||"";
  return `${f}|${ua.slice(0,24)}`;
}

export async function POST(req: Request) {
  let body:any = {};
  try { body = await req.json(); } catch {}
  const msg = body?.text ?? body?.message ?? body?.txt ?? "";
  if (typeof msg !== "string" || !msg.trim()) {
    return NextResponse.json({ ok:false, error:"bad message" }, { status: 400 });
  }
  if (FREE) return NextResponse.json({ ok:true });

  const k = keyFrom(req);
  const now = Date.now();
  const row = hits.get(k) || { n:0, t: now };
  if (now - row.t > 60*60*1000) { row.n = 0; row.t = now; }
  row.n += 1; hits.set(k, row);
  if (row.n > MAX_GUEST) return NextResponse.json({ ok:false, error:"rate limit" }, { status: 429 });
  return NextResponse.json({ ok:true });
}
