import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jsonEcho } from "@/lib/api/xreq";
import { logRTC } from "@/lib/rtc/logger";
import { verifySigned } from "@/lib/rtc/auth";
import { matchmake, pairMapOf } from "@/lib/rtc/mm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

const noStore = <T extends Response>(r:T):T => { try{ (r as any).headers?.set?.("Cache-Control","no-store"); }catch{} return r; };

export async function OPTIONS(req: NextRequest) {
  await cookies();
  const r = new NextResponse(null, { status: 204 });
  r.headers.set("Cache-Control","no-store");
  const rid = req.headers.get("x-req-id"); if (rid) r.headers.set("x-req-id", rid);
  return r;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const rid = req.headers.get("x-req-id") || (globalThis as any).crypto?.randomUUID?.() || `${t0}`;

  try {
    await cookies();
    const raw = req.headers.get("cookie")?.match(/(?:^|;\s*)anon=([^;]+)/)?.[1] || null;
    const sec = process.env.ANON_SIGNING_SECRET!;
    const anonId = raw ? verifySigned(raw, sec) : null;
    if (!anonId) {
      logRTC({ route:"/api/rtc/matchmake", reqId:rid, ms:Date.now()-t0, status:401, note:"no-anon" });
      return noStore(jsonEcho(req, { error:"no-anon" }, { status:401 }));
    }

    // Fast-path: إن كنت مقترنًا بالفعل فأعد الزوج فوريًا
    try {
      const mapped = await pairMapOf(anonId);
      if (mapped?.pairId && mapped?.role) {
        logRTC({ route:"/api/rtc/matchmake", reqId:rid, ms:Date.now()-t0, status:200, note:"mapped-fast" });
        const r = NextResponse.json(
          { pairId: mapped.pairId, role: mapped.role, peerAnonId: mapped.peerAnonId },
          { status: 200 }
        );
        r.headers.set("Cache-Control","no-store");
        if (rid) r.headers.set("x-req-id", rid);
        return r;
      }
    } catch {}

    // تلميحات اختيارية (لا تؤثر على العقد)
    const body = await req.json().catch(() => ({} as any));
    const hint = {
      gender: (body.gender ?? "").toString().toLowerCase() || undefined,
      country: (body.country ?? "").toString().toUpperCase() || undefined,
      filterGenders: (body.filterGenders ?? "").toString() || undefined,
      filterCountries: (body.filterCountries ?? "").toString() || undefined,
    };

    // نعيد مخرجات matchmake بعقد مسطّح متوافق مع العميل
    let out: any;
    try { out = await (matchmake as any)(anonId, hint); }
    catch { out = await (matchmake as any)(anonId); }

    // out = {status, body?}
    if (!out || out === true || out.status === 204) {
      logRTC({ route:"/api/rtc/matchmake", reqId:rid, ms:Date.now()-t0, status:204, note:"no-match-yet" });
      const r = new NextResponse(null, { status: 204 });
      r.headers.set("Cache-Control","no-store");
      if (rid) r.headers.set("x-req-id", rid);
      return r;
    }

    if (out.status === 200 && out.body?.pairId && out.body?.role) {
      logRTC({ route:"/api/rtc/matchmake", reqId:rid, ms:Date.now()-t0, status:200, note:"matched" });
      const r = NextResponse.json(
        { pairId: out.body.pairId, role: out.body.role, peerAnonId: out.body.peerAnonId },
        { status: 200 }
      );
      r.headers.set("Cache-Control","no-store");
      if (rid) r.headers.set("x-req-id", rid);
      return r;
    }

    // أخطاء محددة من mm
    const code = Number(out.status) || 500;
    logRTC({ route:"/api/rtc/matchmake", reqId:rid, ms:Date.now()-t0, status:code, note:"mm-propagate" });
    return noStore(jsonEcho(req, out.body || { error:"mm-fail" }, { status: code }));
  } catch (e: any) {
    logRTC({ route:"/api/rtc/matchmake", reqId:rid, ms:Date.now()-t0, status:500, note:String(e?.message||e).slice(0,100) });
    return noStore(jsonEcho(req, { error:"matchmake-fail", info:String(e?.message||e).slice(0,140) }, { status:500 }));
  }
}
