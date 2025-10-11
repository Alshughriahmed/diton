// /api/rtc/offer
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { R, rjson, rempty, hNoStore, anonFrom, logRTC } from "../_lib";
import { createHash } from "node:crypto";

export const preferredRegion = ["fra1", "iad1"];
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SDP = 200_000;     // ~200KB
const IDEM_TTL_MS = 45_000;  // اديمبوتنسي لكل وسم SDP
const PAIR_TTL_S = 150;      // TTL لسجل الزوج

function sdpTag(sdp: string, kind: "offer" | "answer") {
  const h = createHash("sha1").update(sdp).digest("hex").slice(0, 12);
  return `${kind}:${sdp.length}:${h}`;
}

async function roleOf(anon: string, pairId: string) {
  const map = await R.get(`rtc:pair:map:${anon}`);
  if (!map) return null;
  const [pid, role] = String(map).split("|");
  return pid === pairId ? role : null;
}

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

export async function POST(req: NextRequest) {
  await cookies();

  const hdrs = hNoStore(req);
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403, hdrs);

  // نجمع pairId من عدة أماكن لتفادي اختلافات العميل
  const url = new URL(req.url);
  const pairFromQuery = url.searchParams.get("pairId");
  const pairFromHdr = req.headers.get("x-pair-id");
  const body = await req.json().catch(() => ({} as any));

  const pairId: string =
    (body?.pairId || pairFromHdr || pairFromQuery || "").trim();
  const sdp: string = String(body?.sdp || "");

  if (!pairId || !sdp) return rjson(req, { error: "bad-input" }, 400, hdrs);
  if (Buffer.byteLength(sdp, "utf8") > MAX_SDP)
    return rjson(req, { error: "too-large" }, 413, hdrs);

  const role = await roleOf(anon, pairId);
  if (role !== "caller") return rjson(req, { error: "only-caller" }, 403, hdrs);

  // وسم SDP (من الهيدر إن وُجد أو محسوبًا)
  const tagFromHdr = req.headers.get("x-ditona-sdp-tag") || undefined;
  const tag = tagFromHdr || sdpTag(sdp, "offer");
  const idemKey = `rtc:idem:${pairId}:${role}:${tag}`;

  // اديمبوتنسي: إذا رأينا نفس الوسم مؤخرًا نعيد 204 (لا تغيير)
  const idemHit = !(await R.setNxPx(idemKey, "1", IDEM_TTL_MS));
  if (idemHit) {
    logRTC({
      route: "/api/rtc/offer",
      status: 204,
      rid: req.headers.get("x-req-id"),
      anonId: anon,
      pairId,
      role,
      phase: "idem-hit",
      tag,
    });
    return rempty(req, 204, hdrs);
  }

  // خزّن الـ offer وجدد TTL
  await R.hset(`rtc:pair:${pairId}`, { offer: String(sdp) });
  await R.expire(`rtc:pair:${pairId}`, PAIR_TTL_S);

  logRTC({
    route: "/api/rtc/offer",
    status: 200,
    rid: req.headers.get("x-req-id"),
    anonId: anon,
    pairId,
    role,
    phase: "store",
    tag,
  });

  return rjson(req, { ok: true }, 200, hdrs);
}

export async function GET(req: NextRequest) {
  await cookies();

  const hdrs = hNoStore(req);
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403, hdrs);

  const url = new URL(req.url);
  const pairId = (
    url.searchParams.get("pairId") ||
    req.headers.get("x-pair-id") ||
    ""
  ).trim();
  if (!pairId) return rjson(req, { error: "pair-required" }, 400, hdrs);

  const role = await roleOf(anon, pairId);
  if (role !== "callee") return rjson(req, { error: "only-callee" }, 403, hdrs);

  const pair = await R.hgetall(`rtc:pair:${pairId}`);
  const sdp = pair?.offer;
  if (!sdp) return rempty(req, 204, hdrs);

  await R.expire(`rtc:pair:${pairId}`, PAIR_TTL_S);
  return rjson(req, { sdp: String(sdp) }, 200, hdrs);
}
