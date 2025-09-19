import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // يولّد anonId بسيطًا للاختبارات والإنتاج الأولي
  const anon = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set(
    "set-cookie",
    `anon=${anon}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`
  );
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

// توثيق مبسّط عند GET ليظهر أن المسار يقبل POST فقط
export async function GET() {
  return NextResponse.json({ allow: "POST" }, { status: 405 });
}
