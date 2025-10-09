import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { R, rjson, rempty, hNoStore, anonFrom, logRTC } from "../_lib";
import { createHash } from "node:crypto";

export const preferredRegion = ["fra1","iad1"];
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SDP = 200_000; // ~200KB
const IDEM_TTL_MS = 45_000;
const PAIR_TTL_S = 150;

function sdpTag(sdp: string, kind: "offer"|"answer") {
  const h = createHash("sha1").update(sdp).digest("hex").slice(0,12);
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
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403);

  const body = await req.json().catch(() => ({} as any));
  const pairId: string = body?.pairId;
  const sdp: string = body?.sdp;
  if (!pairId || !sdp) return rjson(req, { error: "bad-input" }, 400);
  if (Buffer.byteLength(sdp, "utf8") > MAX_SDP) return rjson(req, { error: "too-large" }, 413);

  const role = await roleOf(anon, pairId);
  if (role !== "caller") return rjson(req, { error: "only-caller" }, 403);

  const tag = req.headers.get("x-ditona-sdp-tag") || sdpTag(String(sdp), "offer");
  const idemKey = `rtc:idem:${pairId}:${role}:${tag}`;

  const idemHit = !(await R.setNxPx(idemKey, "1", IDEM_TTL_MS));
  if (idemHit) {
    logRTC({ route: "/api/rtc/offer", status: 204, rid: req.headers.get("x-req-id"), anonId: anon, pairId, role, phase: "idem-hit" });
    return rempty(req, 204);
  }

  await R.hset(`rtc:pair:${pairId}`, { offer: String(sdp) });
  await R.expire(`rtc:pair:${pairId}`, PAIR_TTL_S);

  logRTC({ route: "/api/rtc/offer", status: 200, rid: req.headers.get("x-req-id"), anonId: anon, pairId, role, phase: "store" });
  return rjson(req, { ok: true }, 200);
}

export async function GET(req: NextRequest) {
  await cookies();
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403);

  const url = new URL(req.url);
  const pairId = (url.searchParams.get("pairId") || req.headers.get("x-pair-id") || "").trim();
  if (!pairId) return rjson(req, { error: "pair-required" }, 400);

  const role = await roleOf(anon, pairId);
  if (role !== "callee") return rjson(req, { error: "only-callee" }, 403);

  const pair = await R.hgetall(`rtc:pair:${pairId}`);
  const sdp = pair?.offer;
  if (!sdp) return rempty(req, 204);

  await R.expire(`rtc:pair:${pairId}`, PAIR_TTL_S);
  return rjson(req, { sdp: String(sdp) }, 200);
}
