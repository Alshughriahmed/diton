// src/app/api/rtc/_lib.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"]; // بدون as const

export const ICE_GRACE_ENABLED = process.env.ICE_GRACE === "1";
export const redis = Redis.fromEnv();

export type Role = "caller" | "callee";
export type Gender = "m" | "f" | "u";
export type Country = string;

export interface Attrs { gender: Gender; country: Country; ts: number; }
export interface Filters {
  filterGenders: "all" | Gender[];
  filterCountries: "ALL" | Country[];
  ts: number;
}
export interface Pair {
  callerAnon: string;
  calleeAnon: string;
  createdAt: number;
  active: 1 | 0;
  offer?: { sdp: string; tag: string; at: number };
  answer?: { sdp: string; tag: string; at: number };
  iceCaller?: string[];
  iceCallee?: string[];
}

const ATTRS_TTL = 180;
const FILTERS_TTL = 180;
const MAP_TTL = 300;
const PAIR_TTL = 600;
const CLAIM_TTL = 10;
const PREV_TTL = 600;

export const kQ = `rtc:q`;
export const kAttrs   = (anon: string) => `rtc:attrs:${anon}`;
export const kFilters = (anon: string) => `rtc:filters:${anon}`;
export const kPair    = (pairId: string) => `rtc:pair:${pairId}`;
export const kPairMap = (anon: string) => `rtc:pair:map:${anon}`;
export const kClaim   = (anon: string) => `rtc:claim:${anon}`;
export const kLast    = (anon: string) => `rtc:last:${anon}`;
export const kPrevFor = (anon: string) => `rtc:prev-for:${anon}`;
export const kIdem = (pairId: string, role: Role, tag: string) =>
  `rtc:idem:${pairId}:${role}:${tag}`;

function ridFromHeaders() {
  try { return headers().get("x-req-id") || crypto.getRandomValues(new Uint32Array(1))[0].toString(16); }
  catch { return Math.random().toString(16).slice(2); }
}
export function withCommon(res: NextResponse, rid?: string) {
  res.headers.set("Cache-Control", "no-store");
  const id = rid || ridFromHeaders();
  res.headers.set("x-req-id", id);
  return res;
}
export function J(status: number, body: any, rid?: string) {
  return withCommon(NextResponse.json(body, { status }), rid);
}
export function NC(status = 204, rid?: string) {
  return withCommon(new NextResponse(null, { status }), rid);
}
export function BAD(msg = "bad request", rid?: string) { return J(400, { error: msg }, rid); }
export function FORB(msg = "forbidden", rid?: string) { return J(403, { error: msg }, rid); }
export function CONFLICT(msg = "conflict", rid?: string) { return J(409, { error: msg }, rid); }
export function TOOLARGE(msg = "payload too large", rid?: string) { return J(413, { error: msg }, rid); }

export function logEvt(p: Partial<{
  ts: string; route: string; status: number; rid: string;
  anonId: string; pairId: string; role: Role;
  phase: string; mapOK: boolean; pairExists: boolean; note: string;
}>) {
  const rec = { ts: new Date().toISOString(), ...p };
  try { console.log(JSON.stringify(rec)); } catch {}
}

export async function getAnonOrThrow(): Promise<string> {
  const c = (await cookies()).get("anon")?.value;
  if (!c) throw new Error("NO_ANON_COOKIE");
  const anon = c.includes(".") ? c.split(".")[0] : c;
  if (!anon || anon.length < 6) throw new Error("BAD_ANON_COOKIE");
  return anon;
}

export function optionsHandler() {
  const r = new NextResponse(null, { status: 204 });
  r.headers.set("Cache-Control", "no-store");
  return r;
}

export function normalizeAttrs(obj: any): Attrs {
  const gender: Gender = (obj?.gender ?? "u") as Gender;
  const country: Country = (obj?.country ?? "XX") as Country;
  return { gender, country, ts: Date.now() };
}
export function normalizeFilters(obj: any): Filters {
  const g = obj?.filterGenders ?? "all";
  const c = obj?.filterCountries ?? "ALL";
  const ng = g === "all" ? "all" : Array.isArray(g) ? g : [g];
  const nc = c === "ALL" ? "ALL" : Array.isArray(c) ? c : [c];
  return { filterGenders: ng, filterCountries: nc, ts: Date.now() };
}
export async function touchTTL(anon: string) {
  await Promise.all([
    redis.expire(kAttrs(anon), ATTRS_TTL),
    redis.expire(kFilters(anon), FILTERS_TTL),
  ]);
}
export function newPairId(): string {
  const ts = Date.now().toString(36);
  const r = crypto.getRandomValues(new Uint32Array(2));
  return `p:${ts}:${(r[0].toString(36)+r[1].toString(36)).slice(0,8)}`;
}
export async function enqueueIntoQ(anon: string) {
  await redis.zadd(kQ, { member: anon, score: Date.now(), nx: true });
}
export async function pickCandidate(selfAnon: string): Promise<string | null> {
  const window = await redis.zrange<string>(kQ, 0, 19);
  if (!window?.length) return null;
  for (const cand of window) {
    if (cand === selfAnon) continue;
    const ok = await redis.set(kClaim(cand), `by:${selfAnon}`, { nx: true, ex: CLAIM_TTL });
    if (ok !== "OK") continue;
    return cand;
  }
  return null;
}
export async function createPairAndMap(callerAnon: string, calleeAnon: string) {
  const pairId = newPairId();
  const pair: Pair = { callerAnon, calleeAnon, createdAt: Date.now(), active: 1 };
  await Promise.all([
    redis.set(kPair(pairId), JSON.stringify(pair), { ex: PAIR_TTL }),
    redis.set(kPairMap(callerAnon), pairId, { ex: MAP_TTL }),
    redis.set(kPairMap(calleeAnon), pairId, { ex: MAP_TTL }),
    redis.set(kPrevFor(callerAnon), calleeAnon, { ex: PREV_TTL }),
    redis.set(kPrevFor(calleeAnon), callerAnon, { ex: PREV_TTL }),
    redis.set(kLast(callerAnon), JSON.stringify({ ts: Date.now(), note: "paired", pairId }), { ex: PREV_TTL }),
    redis.set(kLast(calleeAnon), JSON.stringify({ ts: Date.now(), note: "paired", pairId }), { ex: PREV_TTL }),
  ]);
  return { pairId };
}
export async function getPairAndRole(anon: string, pairId: string): Promise<{ pair: Pair|null; role: Role|null; peer: string|null }> {
  const s = await redis.get<string>(kPair(pairId));
  if (!s) return { pair: null, role: null, peer: null };
  const p = JSON.parse(s) as Pair;
  if (p.callerAnon === anon) return { pair: p, role: "caller", peer: p.calleeAnon };
  if (p.calleeAnon === anon) return { pair: p, role: "callee", peer: p.callerAnon };
  return { pair: null, role: null, peer: null };
}
