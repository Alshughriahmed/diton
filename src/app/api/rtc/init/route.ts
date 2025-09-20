import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signAnon(anon: string, sec?: string|null): string {
  if (!sec) return anon; // يبقى خام في غياب السر (dev فقط)
  const b64 = Buffer.from(anon, "utf8").toString("base64url");
  const sig = createHmac("sha256", sec).update(b64).digest("hex");
  return ;
}

export async function POST() {
  const anon = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const sec = process.env.ANON_SIGNING_SECRET || process.env.VIP_SIGNING_SECRET || null;
  const cookieVal = signAnon(anon, sec);

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set(
    "set-cookie",
    
  );
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET() {
  return NextResponse.json({ allow: "POST" }, { status: 405 });
}
