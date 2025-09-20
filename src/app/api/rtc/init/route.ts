import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID, createHmac } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signAnon(raw: string, secret?: string) {
  if (!secret) return raw; // يسمح بالعمل بدون توقيع لو السر غير مضبوط
  const b64 = Buffer.from(raw, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(b64).digest("hex");
  return `${raw}.${sig}`;
}

function setAnonCookie() {
  const jar = cookies();
  const existing = jar.get("anon")?.value;
  const raw = existing?.split(".")[0] || randomUUID();
  const secret = process.env.ANON_SIGNING_SECRET;
  const value = signAnon(raw, secret);
  jar.set("anon", value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  return value;
}

export async function POST() {
  setAnonCookie();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export async function GET() {
  return POST();
}
