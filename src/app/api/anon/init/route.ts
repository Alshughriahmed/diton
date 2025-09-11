import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export const runtime = "nodejs";

function sign(v: string, sec: string) {
  const b = Buffer.from(v, "utf8").toString("base64url");
  const s = createHmac("sha256", sec).update(b).digest("hex");
  return `${b}.${s}`;
}

export async function GET() {
  const sec = process.env.ANON_SIGNING_SECRET || process.env.VIP_SIGNING_SECRET || "fallback-dev-secret-not-for-production";
  if (!sec) return NextResponse.json({ error: "secret-missing" }, { status: 500 });
  
  const id = (crypto as any).randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  const cookie = sign(id, sec);
  
  const res = NextResponse.json({ ok: true, anonId: id }, { status: 200 });
  res.cookies.set("anon", cookie, {
    httpOnly: true, 
    secure: true, 
    sameSite: "lax", 
    path: "/", 
    maxAge: 60 * 60 * 24 * 180,
    domain: ".ditonachat.com"
  });
  
  return res;
}