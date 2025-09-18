import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "crypto";
export const runtime = "nodejs";
function sign(v: string, sec: string) {
  const b = Buffer.from(v, "utf8").toString("base64url");
  const s = createHmac("sha256", sec).update(b).digest("hex");
  return `${b}.${s}`;
}
export async function GET() {
  const sec = process.env.ANON_SIGNING_SECRET || process.env.VIP_SIGNING_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-anon-secret' : "");
  const id = randomUUID();
  
  let cookie: string;
  if (process.env.NODE_ENV !== 'production' && !process.env.ANON_SIGNING_SECRET && !process.env.VIP_SIGNING_SECRET) {
    // In dev without secrets, use raw ID for easier testing
    cookie = id;
  } else if (sec) {
    cookie = sign(id, sec);
  } else {
    return NextResponse.json({ ok:false, error:"secret-missing" }, { status: 500 });
  }
  
  const res = NextResponse.json({ ok:true, anonId:id });
  res.cookies.set("anon", cookie, { httpOnly:true, secure:true, sameSite:"lax", path:"/", maxAge:60*60*24*180 });
  return res;
}
export const dynamic="force-dynamic";
