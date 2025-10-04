export const revalidate = 0;
import { cookies } from "next/headers";
import { withReqId } from "@/lib/http/withReqId";
import { NextResponse } from "next/server";
import { randomUUID, createHmac } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signAnon(raw: string, secret?: string) {
  if (!secret) return raw; // يسمح بالعمل بدون توقيع لو السر غير مضبوط
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  return `${raw}.${sig}`;
}

async function setAnonCookie() {
  const jar = await cookies();
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
  await setAnonCookie();
  return withReqId(NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }));
}

export async function GET() {
  return POST();
}
