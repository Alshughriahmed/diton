import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { R, rjson, rempty, hNoStore, anonFrom, logRTC } from "../_lib";
import { matchmake } from "@/lib/rtc/mm"; // طبقة الاختيار/الزوج الذرّي لديكم

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

async function fastPath(anon: string) {
  const map = await R.get(`rtc:pair:map:${anon}`);
  if (!map) return null;
  const [pairId, role] = String(map).split("|");
  if (!pairId || !role) { await R.del(`rtc:pair:map:${anon}`); return null; }
  const exists = await R.exists(`rtc:pair:${pairId}`);
  if (!exists) { await R.del(`rtc:pair:map:${anon}`); return null; }
  const p = await R.hgetall(`rtc:pair:${pairId}`);
  const a = p?.a || p?.callerAnon, b = p?.b || p?.calleeAnon;
  const ok = (a === anon && (role === "caller" || p?.role_a === "caller"))
          || (b === anon && (role === "callee" || p?.role_b === "callee"));
  if (!ok) { await R.del(`rtc:pair:map:${anon}`); return null; }
  return { pairId, role, peerAnonId: a === anon ? b : a };
}

async function handle(req: NextRequest) {
  await cookies();
  const rid = req.headers.get("x-req-id") || "";
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403);

  // fast-path
  const fp = await fastPath(anon);
  if (fp) {
    logRTC({ route: "/api/rtc/matchmake", status: 200, rid, anonId: anon, pairId: fp.pairId, role: fp.role, phase: "fast-path", mapOK: true, pairExists: true });
    return rjson(req, { pairId: fp.pairId, role: fp.role, peerAnonId: fp.peerAnonId }, 200);
  }

  // guard: attrs must exist for THIS anon (لا 204 مصطنعة هنا)
  const attrs = await R.get(`rtc:attrs:${anon}`);
  if (!attrs) {
    logRTC({ route: "/api/rtc/matchmake", status: 400, rid, anonId: anon, phase: "no-attrs" });
    return rjson(req, { error: "attrs-missing" }, 400);
  }

  const out = await matchmake(anon); // يعيد {status, body} أو 204
  const st = out?.status ?? 204;
  logRTC({ route: "/api/rtc/matchmake", status: st, rid, anonId: anon, phase: "mm" });

  if (st === 204) return rempty(req, 204);
  return rjson(req, out?.body || {}, st);
}

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}
export const GET = handle;
export const POST = handle;
