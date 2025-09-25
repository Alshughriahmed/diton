import { NextResponse } from "next/server";

export async function POST() {
  // ممنوع على الإنتاج
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
  if (env === "production") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  
  const res = NextResponse.json({ ok: true, note: "dev vip cookie set" });
  res.headers.append(
    "Set-Cookie",
    // دومينك الإنتاجي—في المعاينة يمكن سقوطه تلقائياً
    `vip=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
  return res;
}export const runtime="nodejs";
export const dynamic="force-dynamic";
