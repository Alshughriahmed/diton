// src/lib/match/redis.ts
// Score-based matching per matching.md + ss.md.
// Upstash REST only. Store ticket attrs as JSON via SET/GET (no HSET).

export type GenderNorm = "m" | "f" | "c" | "l" | "u";

export interface TicketAttrs {
  ticket: string;
  identity: string;
  deviceId: string;
  selfGender: GenderNorm;
  selfCountry: string | null; // ISO2 or null
  filterGenders: Exclude<GenderNorm, "u">[]; // 0..2
  filterCountries: string[]; // 0..15 ISO2
  vip: boolean;
  ts: number; // enqueue time (ms)
}

export interface MatchResult {
  room?: string;
  matchedWith?: string;
}

const BASE = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

export function haveRedisEnv(): boolean {
  return !!(BASE && TOKEN);
}

if (!haveRedisEnv()) {
  // eslint-disable-next-line no-console
  console.warn("[match/redis] Missing UPSTASH_REDIS_* env. Server handlers must guard with haveRedisEnv().");
}

/* ================= Upstash REST helpers ================= */

type Cmd = (string | number)[];

function toStrArray(cmd: Cmd): string[] {
  return cmd.map((x) => String(x));
}

async function redisCmd(cmd: Cmd): Promise<any> {
  if (!haveRedisEnv()) throw new Error("Upstash env missing");
  const arr = toStrArray(cmd);
  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    // Upstash expects raw array, not {command: arr}
    body: JSON.stringify(arr),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || (j && (j.error || j.err))) {
    const msg = j?.error || j?.err || res.statusText || "unknown";
    throw new Error(`UPSTASH ${arr[0]}: ${msg}`);
  }
  return (j && typeof j === "object" && "result" in j) ? j.result : j;
}

async function redisPipeline(cmds: Cmd[]): Promise<any[]> {
  if (!haveRedisEnv()) throw new Error("Upstash env missing");
  const arr = cmds.map((c) => toStrArray(c));
  const res = await fetch(BASE + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    // Upstash expects raw array-of-arrays, not {commands: arr}
    body: JSON.stringify(arr),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || (j && (j.error || j.err))) {
    const msg = j?.error || j?.err || res.statusText || "unknown";
    throw new Error(`UPSTASH PIPELINE: ${msg}`);
  }
  const out: any[] = Array.isArray(j) ? j : Array.isArray((j as any).result) ? (j as any).result : [];
  return out.map((x: any) => (x && typeof x === "object" && "result" in x ? x.result : x));
}

async function zcard(key: string): Promise<number> {
  return Number(await redisCmd(["ZCARD", key]));
}

async function zrangebyscore(
  key: string,
  min: number,
  max: number,
  offset: number,
  count: number
): Promise<string[]> {
  const r = await redisCmd(["ZRANGEBYSCORE", key, String(min), String(max), "LIMIT", String(offset), String(count)]);
  return Array.isArray(r) ? r.map(String) : [];
}

async function zremrangebyscore(key: string, min: number, max: number): Promise<number> {
  return Number(await redisCmd(["ZREMRANGEBYSCORE", key, String(min), String(max)]));
}

async function setNXPX(key: string, value: string, ttlMs: number): Promise<boolean> {
  const r = await redisCmd(["SET", key, value, "NX", "PX", String(ttlMs)]);
  return r === "OK";
}

async function setPX(key: string, value: string, ttlMs: number): Promise<boolean> {
  const r = await redisCmd(["SET", key, value, "PX", String(ttlMs)]);
  return r === "OK";
}

async function getStr(key: string): Promise<string | null> {
  const r = await redisCmd(["GET", key]);
  return r == null ? null : String(r);
}

async function pexpire(key: string, ttlMs: number): Promise<number> {
  return Number(await redisCmd(["PEXPIRE", key, String(ttlMs)]));
}

async function del(key: string): Promise<number> {
  return Number(await redisCmd(["DEL", key]));
}

async function zrem(key: string, ...members: string[]): Promise<number> {
  return Number(await redisCmd(["ZREM", key, ...members]));
}

// Update score always (no NX) to keep recency fresh for re-enqueues
async function zaddRecency(key: string, score: number, member: string): Promise<number> {
  return Number(await redisCmd(["ZADD", key, String(score), member]));
}

/* ================= Keys / consts ================= */

const Q_KEY = "mq:q";
const ATTR_KEY = (t: string) => `mq:attr:${t}`; // stores JSON string
const ROOM_KEY = (t: string) => `mq:room:${t}`;
const DEV_KEY = (d: string) => `mq:dev:${d}`; // reuse ticket per device
const LOCK_KEY = (t: string) => `mq:lock:${t}`;
const TTL_MS = 45_000;

/* ================= Normalizers ================= */

function normalizeGender(g: any): GenderNorm {
  const s = String(g || "").toLowerCase();
  if (s === "m" || s.startsWith("male")) return "m";
  if (s === "f" || s.startsWith("female") || s === "w") return "f";
  if (s === "c" || s.startsWith("couple")) return "c";
  if (s === "l" || s.startsWith("lgbt") || s.startsWith("gay") || s.startsWith("bi")) return "l";
  if (s === "u" || s === "unknown" || s === "everyone" || s === "all" || s === "*") return "u";
  return "u";
}

function csvToArray(s: string | null | undefined): string[] {
  if (!s) return [];
  return String(s).split(",").map((x) => x.trim()).filter(Boolean);
}

function toCSV(arr: string[]): string {
  return arr.join(",");
}

/* ================= Read helpers ================= */

export async function getRoom(ticket: string): Promise<string | null> {
  const r = await redisCmd(["GET", ROOM_KEY(ticket)]);
  return r ? String(r) : null;
}

async function getTicketRaw(ticket: string): Promise<Record<string, any> | null> {
  const txt = await getStr(ATTR_KEY(ticket));
  if (!txt) return null;
  try {
    const obj = JSON.parse(txt);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

export async function getTicketAttrs(ticket: string): Promise<TicketAttrs | null> {
  const h = await getTicketRaw(ticket);
  if (!h) return null;
  const selfCountry = h.selfCountry ? String(h.selfCountry).toUpperCase() : null;
  const genders = csvToArray(h.filterGendersCSV).map(normalizeGender).filter((g) => g !== "u") as Exclude<
    GenderNorm,
    "u"
  >[];
  const countries = csvToArray(h.filterCountriesCSV).map((x) => x.toUpperCase());
  return {
    ticket,
    identity: String(h.identity || ""),
    deviceId: String(h.deviceId || ""),
    selfGender: normalizeGender(h.selfGender || "u"),
    selfCountry,
    filterGenders: genders.slice(0, 2),
    filterCountries: countries.slice(0, 15),
    vip: !!(+String(h.vip || "0")),
    ts: Number(h.ts || Date.now()),
  };
}

/* ================= Matching core ================= */

function elapsedLevel(elapsedMs: number): 0 | 1 | 2 | 3 | 4 {
  if (elapsedMs < 3000) return 0; // 0–3s: hard only
  if (elapsedMs < 8000) return 1; // 3–8s: hard only
  if (elapsedMs < 12000) return 2; // 8–12s: relax country
  if (elapsedMs < 20000) return 3; // 12–20s: soft if no explicit gender blocks
  return 4; // stop trying here; client keeps polling
}

type ScoreTuple = [number, number, number, number]; // (hardFlag, genderRank, countryRank, recencyRank)

function indexOfOrInf<T>(arr: T[] | null | undefined, v: T): number {
  if (!arr || arr.length === 0) return Number.POSITIVE_INFINITY;
  const i = arr.indexOf(v);
  return i >= 0 ? i : Number.POSITIVE_INFINITY;
}

function jitter(seed: string): number {
  // stable small perturbation in [-0.2 .. +0.2]
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  const x = (h >>> 0) / 0xffffffff;
  return (x - 0.5) * 0.4;
}

function hardOK(me: TicketAttrs, other: TicketAttrs): boolean {
  const meG = me.filterGenders;
  const otherG = other.filterGenders;
  const meC = me.filterCountries;
  const otherC = other.filterCountries;

  const meAcceptsGender = meG.length === 0 || meG.includes(other.selfGender as any);
  const otherAcceptsGender = otherG.length === 0 || otherG.includes(me.selfGender as any);

  const meAcceptsCountry = meC.length === 0 || (!!other.selfCountry && meC.includes(other.selfCountry));
  const otherAcceptsCountry = otherC.length === 0 || (!!me.selfCountry && otherC.includes(me.selfCountry));

  return meAcceptsGender && otherAcceptsGender && meAcceptsCountry && otherAcceptsCountry;
}

function allowedByWiden(level: 0 | 1 | 2 | 3 | 4, me: TicketAttrs, other: TicketAttrs): boolean {
  const meG = me.filterGenders;
  const otherG = other.filterGenders;
  const meC = me.filterCountries;
  const otherC = other.filterCountries;

  const genderMutual =
    (meG.length === 0 || meG.includes(other.selfGender as any)) &&
    (otherG.length === 0 || otherG.includes(me.selfGender as any));

  const countryMutual =
    (meC.length === 0 || (!!other.selfCountry && meC.includes(other.selfCountry))) &&
    (otherC.length === 0 || (!!me.selfCountry && otherC.includes(me.selfCountry)));

  if (level === 0 || level === 1) return genderMutual && countryMutual; // hard only
  if (level === 2) return genderMutual; // relax country
  if (level === 3) {
    if (genderMutual && countryMutual) return true;
    if (genderMutual) return true;
    const meBlocks = meG.length > 0 && !meG.includes(other.selfGender as any);
    const otherBlocks = otherG.length > 0 && !otherG.includes(me.selfGender as any);
    return !(meBlocks || otherBlocks);
  }
  return false;
}

function computeScore(level: 0 | 1 | 2 | 3 | 4, me: TicketAttrs, other: TicketAttrs): ScoreTuple | null {
  if (!allowedByWiden(level, me, other)) return null;

  const genderOrder = me.filterGenders;
  const countryOrder = me.filterCountries;

  const genderRank =
    genderOrder.length === 0 ? Number.POSITIVE_INFINITY : indexOfOrInf(genderOrder, other.selfGender as any);

  let countryRank: number;
  if (countryOrder.length === 0) {
    countryRank = other.selfCountry && me.selfCountry && other.selfCountry === me.selfCountry ? 0 : 1;
    countryRank += jitter(`${me.ticket}|${other.ticket}`);
  } else {
    countryRank = indexOfOrInf(countryOrder, other.selfCountry as any);
  }

  const recencyRank = -other.ts;
  const hardFlag = hardOK(me, other) ? 0 : 1;

  return [hardFlag, genderRank, countryRank, recencyRank];
}

function lexLess(a: ScoreTuple, b: ScoreTuple): boolean {
  for (let i = 0; i < 4; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

function roomNameFor(a: string, b: string): string {
  const short = Date.now().toString(36).slice(-5);
  return `pair-${short}-${a.slice(-3)}${b.slice(-3)}`;
}

async function claimBoth(me: string, other: string, ttlMs: number, room: string): Promise<boolean> {
  const locked = await setNXPX(LOCK_KEY(other), me, ttlMs > 4000 ? 4000 : ttlMs);
  if (!locked) return false;
  try {
    const a = await setNXPX(ROOM_KEY(me), room, ttlMs);
    if (!a) return false;
    const b = await setNXPX(ROOM_KEY(other), room, ttlMs);
    if (!b) {
      await del(ROOM_KEY(me));
      return false;
    }
    await zrem(Q_KEY, me, other);
    return true;
  } finally {
    await del(LOCK_KEY(other));
  }
}

/**
 * tryMatch:
 * second param kept for compat. If number, treated as "now".
 */
export async function tryMatch(ticket: string, widenOrNow?: boolean | number): Promise<MatchResult | null> {
  const assigned = await getRoom(ticket);
  if (assigned) return { room: assigned };

  const me = await getTicketAttrs(ticket);
  if (!me) return null;

  const now = typeof widenOrNow === "number" ? widenOrNow : Date.now();
  const elapsed = now - me.ts;
  const level = elapsedLevel(elapsed);
  if (level === 4) return null;

  const qCount = await zcard(Q_KEY);
  const PAGE = 64;
  let target = 64;
  if (qCount > 2000) target = 256;
  else if (qCount > 200) target = 128;

  const minScore = now - TTL_MS;
  const maxScore = now;

  let collected: string[] = [];
  let offset = 0;
  while (collected.length < target && offset < 1024) {
    const batch = await zrangebyscore(Q_KEY, minScore, maxScore, offset, PAGE);
    if (!batch.length) break;
    for (const t of batch) {
      if (t && t !== ticket) collected.push(t);
      if (collected.length >= target) break;
    }
    offset += PAGE;
  }

  if (collected.length === 0) return null;

  // pipeline: GET(attr-json) + EXISTS(room)
  const cmds: Cmd[] = [];
  for (const t of collected) {
    cmds.push(["GET", ATTR_KEY(t)]);
    cmds.push(["EXISTS", ROOM_KEY(t)]);
  }
  const res = await redisPipeline(cmds);

  let best: { ticket: string; score: ScoreTuple } | null = null;

  for (let i = 0; i < collected.length; i++) {
    const txt = res[i * 2] as string | null;
    const ex = res[i * 2 + 1];
    if (!txt || Number(ex) > 0) continue;

    let data: any = null;
    try {
      data = JSON.parse(String(txt));
    } catch {
      continue;
    }
    if (!data || typeof data !== "object") continue;

    const other: TicketAttrs = {
      ticket: collected[i],
      identity: String(data.identity || ""),
      deviceId: String(data.deviceId || ""),
      selfGender: normalizeGender(data.selfGender || "u"),
      selfCountry: data.selfCountry ? String(data.selfCountry).toUpperCase() : null,
      filterGenders: csvToArray(data.filterGendersCSV).map(normalizeGender).filter((g) => g !== "u") as Exclude<
        GenderNorm,
        "u"
      >[],
      filterCountries: csvToArray(data.filterCountriesCSV).map((x) => x.toUpperCase()),
      vip: !!(+String(data.vip || "0")),
      ts: Number(data.ts || now),
    };

    const sc = computeScore(level, me, other);
    if (!sc) continue;
    if (!best || lexLess(sc, best.score)) best = { ticket: other.ticket, score: sc };
  }

  if (!best) return null;

  const room = roomNameFor(ticket, best.ticket);
  const ok = await claimBoth(ticket, best.ticket, TTL_MS, room);
  if (!ok) return null;

  return { room, matchedWith: best.ticket };
}

/* ================= Enqueue ================= */

export interface EnqueueInput {
  identity: string;
  deviceId: string;
  selfGender?: any;
  selfCountry?: string | null;
  filterGenders?: any[];
  filterCountries?: string[];
  vip?: boolean;
  ts?: number;
  ticketHint?: string | null;
}

function genTicket(deviceId: string): string {
  const rand = Math.random().toString(36).slice(2, 7);
  const tail = deviceId ? deviceId.replace(/[^a-zA-Z0-9]/g, "").slice(-4) : "xxxx";
  return `t${Date.now().toString(36)}-${tail}-${rand}`;
}

export async function enqueue(inp: EnqueueInput): Promise<{ ticket: string; ts: number }> {
  const now = Date.now();
  const ts = Number.isFinite(inp.ts as any) ? Number(inp.ts) : now;

  // reuse ticket per device within TTL
  let ticket = String(inp.ticketHint || "");
  if (!ticket && inp.deviceId) {
    try {
      const reuse = await redisCmd(["GET", DEV_KEY(inp.deviceId)]);
      if (reuse) ticket = String(reuse);
    } catch {}
  }
  if (!ticket) ticket = genTicket(inp.deviceId || "");

  const selfGender = normalizeGender(inp.selfGender || "u");
  const filterGenders = (inp.filterGenders || [])
    .map(normalizeGender)
    .filter((g) => g !== "u")
    .slice(0, 2) as Exclude<GenderNorm, "u">[];

  const filterCountries = (inp.filterCountries || []).map((x) => String(x).toUpperCase()).slice(0, 15);

  const obj: Record<string, any> = {
    identity: String(inp.identity || ""),
    deviceId: String(inp.deviceId || ""),
    selfGender,
    selfCountry: inp.selfCountry ? String(inp.selfCountry).toUpperCase() : null,
    filterGendersCSV: toCSV(filterGenders as unknown as string[]),
    filterCountriesCSV: toCSV(filterCountries),
    vip: !!inp.vip,
    ts,
  };

  // store JSON with TTL in single SET
  try {
    await setPX(ATTR_KEY(ticket), JSON.stringify(obj), TTL_MS); // [ATTR:SET]
  } catch (e: any) {
    throw new Error(`[ATTR:SET] ${e?.message || e}`);
  }

  // device mapping
  if (inp.deviceId) {
    try {
      await redisCmd(["SET", DEV_KEY(inp.deviceId), ticket, "PX", String(TTL_MS)]); // [DEV:SET]
    } catch (e: any) {
      throw new Error(`[DEV:SET] ${e?.message || e}`);
    }
  }

  // queue push with recency score (no NX → refreshes timestamp)
  try {
    await zaddRecency(Q_KEY, ts, ticket); // [Q:ZADD]
  } catch (e: any) {
    throw new Error(`[Q:ZADD] ${e?.message || e}`);
  }

  // sweep old entries
  try {
    await zremrangebyscore(Q_KEY, 0, now - TTL_MS); // [Q:SWEEP]
  } catch (e: any) {
    throw new Error(`[Q:SWEEP] ${e?.message || e}`);
  }

  return { ticket, ts };
}
