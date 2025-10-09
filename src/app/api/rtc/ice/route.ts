import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { R, rjson, rempty, hNoStore, anonFrom, logRTC } from "../_lib";

export const preferredRegion = ["fra1","iad1"];
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_CAND_BYTES = 4 * 1024;
const ICE_MAX = 100;
const PAIR_TTL_S = 150;
const GRACE_MS = (process.env.ICE_GRACE ?? "1") === "0" ? 0 : 5000; // ICE_GRACE≤5s

function sizeOk(candidate: any): boolean {
  try {
    const s = JSON.stringify(candidate);
    return Buffer.byteLength(s, "utf8") <= MAX_CAND_BYTES;
  } catch { return false; }
}

async function myRoleFor(anon: string, pairId: string) {
  const map = await R.get(`rtc:pair:map:${anon}`);
  if (!map) return null;
  const [pid, role] = String(map).split("|");
  return pid === pairId ? (role as "caller"|"callee") : null;
}

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

// push my candidate to the peer (store inside pair hash)
export async function POST(req: NextRequest) {
  await cookies();
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403);

  const b: any = await req.json().catch(() => ({}));
  const pairId = String(b?.pairId || "");
  const role   = String(b?.role || "");
  const cand   = b?.candidate;

  if (!pairId || !role || !cand) return rjson(req, { error: "bad-input" }, 400);
  if (!sizeOk(cand)) return rjson(req, { error: "too-large" }, 413);

  const myRole = await myRoleFor(anon, pairId);
  if (!myRole || myRole !== role) return rjson(req, { error: "forbidden" }, 403);

  const dstField = myRole === "caller" ? "ice_b" : "ice_a"; // push to the peer
  const pair = await R.hgetall(`rtc:pair:${pairId}`);
  const arr: any[] = pair?.[dstField] ? JSON.parse(String(pair[dstField])) : [];
  arr.push(cand);
  if (arr.length > ICE_MAX) arr.splice(0, arr.length - ICE_MAX);

  await R.hset(`rtc:pair:${pairId}`, { [dstField]: JSON.stringify(arr) });
  await R.expire(`rtc:pair:${pairId}`, PAIR_TTL_S);

  logRTC({ route: "/api/rtc/ice", status: 204, rid: req.headers.get("x-req-id"), anonId: anon, pairId, role, phase: "push" });
  return rempty(req, 204);
}

// poll candidates destined to me (with ICE-Grace)
export async function GET(req: NextRequest) {
  await cookies();
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403);

  const url = new URL(req.url);
  const pairId = (url.searchParams.get("pairId") || req.headers.get("x-pair-id") || "").trim();
  if (!pairId) return rjson(req, { error: "pair-required" }, 400);

  const role = await myRoleFor(anon, pairId);
  if (!role) {
    const lastStopTs = Number(req.headers.get("x-last-stop-ts") || 0);
    const graceApplied = GRACE_MS > 0 && lastStopTs > 0 && (Date.now() - lastStopTs) <= GRACE_MS;
    logRTC({ route: "/api/rtc/ice", status: graceApplied ? 204 : 403, rid: req.headers.get("x-req-id"), anonId: anon, pairId, phase: "grace-check", graceApplied });
    if (graceApplied) return rempty(req, 204);
    return rjson(req, { error: "forbidden" }, 403);
  }

  const myField = role === "caller" ? "ice_a" : "ice_b";
  const pair = await R.hgetall(`rtc:pair:${pairId}`);
  const arr: any[] = pair?.[myField] ? JSON.parse(String(pair[myField])) : [];
  if (!arr.length) return rempty(req, 204);

  await R.hset(`rtc:pair:${pairId}`, { [myField]: JSON.stringify([]) });
  await R.expire(`rtc:pair:${pairId}`, PAIR_TTL_S);

  logRTC({ route: "/api/rtc/ice", status: 200, rid: req.headers.get("x-req-id"), anonId: anon, pairId, role, phase: "poll", count: arr.length });
  return rjson(req, arr, 200);
}
