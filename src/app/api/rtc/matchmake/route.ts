import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { R, rjson, rempty, hNoStore, anonFrom, logRTC } from "../_lib";
import { matchmake } from "@/lib/rtc/mm"; // موجود لديكم ويقوم بالاختيار/الإنشاء

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

async function fastPath(anon: string) {
  const map = await R.get(`rtc:pair:map:${anon}`);
  if (!map) return null;
  const [pairId, role] = String(map).split("|");
  if (!pairId || !role) {
    await R.del(`rtc:pair:map:${anon}`);
    return null;
  }
  const pairExists = await R.exists(`rtc:pair:${pairId}`);
  if (!pairExists) {
    await R.del(`rtc:pair:map:${anon}`);
    return null;
  }
  const p = await R.hgetall(`rtc:pair:${pairId}`);
  const a = p?.a || p?.callerAnon, b = p?.b || p?.calleeAnon;
  const ok = (a === anon && (role === "caller" || p?.role_a === "caller")) ||
             (b === anon && (role === "callee" || p?.role_b === "callee"));
  if (!ok) {
    await R.del(`rtc:pair:map:${anon}`);
    return null;
  }
  const peerAnonId = a === anon ? b : a;
  return { pairId, role, peerAnonId, pairExists: true };
}

async function handle(req: NextRequest) {
  const t0 = Date.now();
  await cookies();
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403);

  // 1) Fast-path (تحقق من الخريطة + وجود الزوج)
  const fp = await fastPath(anon);
  if (fp) {
    logRTC({ route: "/api/rtc/matchmake", status: 200, rid: req.headers.get("x-req-id"), anonId: anon, ...fp, phase: "fast-path" });
    return rjson(req, { pairId: fp.pairId, role: fp.role, peerAnonId: fp.peerAnonId }, 200);
  }

  // 2) attrs guard: غياب attrs => 400 (حالتكم الحالية إذا كان Redis مُعطلاً)
  const attrs = await R.get(`rtc:attrs:${anon}`);
  if (!attrs) {
    logRTC({ route: "/api/rtc/matchmake", status: 400, rid: req.headers.get("x-req-id"), anonId: anon, phase: "no-attrs" });
    return rjson(req, { error: "attrs-missing" }, 400);
  }

  // 3) المسار العادي عبر طبقتكم (قفل/عدالة/إنشاء زوج وكتابة الخرائط)
  const out = await matchmake(anon); // يُفترض أن يعيد {status, body}
  logRTC({
    route: "/api/rtc/matchmake",
    status: out?.status ?? 204,
    rid: req.headers.get("x-req-id"),
    anonId: anon,
    phase: "mm",
    latencyMs: Date.now() - t0,
  });

  if (!out?.status || out.status === 204) return rempty(req, 204);
  return rjson(req, out.body || {}, out.status);
}

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}
export const GET = handle;
export const POST = handle;
