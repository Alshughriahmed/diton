// src/lib/match/redis.ts
// Score-based matching per matching.md and ss.md without extra deps.
// Uses Upstash REST directly via fetch. No new dependencies.
//
// ENV required: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.

export type GenderNorm = "m" | "f" | "c" | "l" | "u";

export interface TicketAttrs {
  ticket: string;
  identity: string;
  deviceId: string;
  selfGender: GenderNorm;       // normalized
  selfCountry: string | null;   // ISO2 or null
  filterGenders: GenderNorm[];  // 0..2
  filterCountries: string[];    // 0..15 ISO2
  vip: boolean;
  ts: number;                   // enqueue time (ms)
}

export interface MatchResult {
  room?: string;
  matchedWith?: string; // other ticket
}

const BASE = process.env.UPSTASH_REDIS_REST_URL as string;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN as string;

if (!BASE || !TOKEN) {
  throw new Error("UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are required");
}

// ---- minimal Upstash REST helpers ----
type Cmd = (string | number)[];

async function redisCmd(cmd: Cmd): Promise<any> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command: cmd }),
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(j.error || res.statusText);
  return j.result;
}

async function redisPipeline(cmds: Cmd[]): Promise<any[]> {
  const res = await fetch(BASE + "/pipeline", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ commands: cmds }),
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(j.error || res.statusText);
  // Upstash returns array like [{result:...}, {result:...}]
  return (Array.isArray(j) ? j : j.result).map((x: any) => (x?.result ?? x));
}

async function zcard(key: string): Promise<number> {
  return Number(await redisCmd(["ZCARD", key]));
}

async function zrangebyscore(key: string, min: number, max: number, offset: number, count: number): Promise<string[]> {
  // LIMIT offset count
  const r = await redisCmd(["ZRANGEBYSCORE", key, min, max, "LIMIT", offset, count]);
  return Array.isArray(r) ? r.map(String) : [];
}

async function hgetallObj(key: string): Promise<Record<string, string> | null> {
  const r = await redisCmd(["HGETALL", key]);
  if (!r) return null;
  if (Array.isArray(r)) {
    const obj: Record<string, string> = {};
    for (let i = 0; i < r.length; i += 2) obj[String(r[i])] = String(r[i + 1] ?? "");
    return obj;
  }
  if (typeof r === "object") return r as Record<string, string>;
  return null;
}

async function exists(key: string): Promise<boolean> {
  const n = await redisCmd(["EXISTS", key]);
  return Number(n) > 0;
}

async function setNXPX(key: string, value: string, ttlMs: number): Promise<boolean> {
  const r = await redisCmd(["SET", key, value, "NX", "PX", ttlMs]);
  return r === "OK";
}

async function setNX(key: string, value: string, ttlMs: number): Promise<boolean> {
  // same as setNXPX for lock with PX
  return setNXPX(key, value, ttlMs);
}

async function del(key: string): Promise<number> {
  return Number(await redisCmd(["DEL", key]));
}

async function zrem(key: string, ...members: string[]): Promise<number> {
  return Number(await redisCmd(["ZREM", key, ...members]));
}

// ---- matching logic ----

const Q_KEY = "mq:q";
const ATTR_KEY = (ticket: string) => `mq:attr:${ticket}`;
const ROOM_KEY = (ticket: string) => `mq:room:${ticket}`;
const DEV_KEY = (dev: string) => `mq:dev:${dev}`; // reserved
const LOCK_KEY = (ticket: string) => `mq:lock:${ticket}`;

const TTL_MS = 45_000;

export function normalizeGender(g: any): GenderNorm {
  const s = String(g || "").toLowerCase();
  if (s === "m" || s.startsWith("male")) return "m";
  if (s === "f" || s.startsWith("female") || s === "w") return "f";
  if (s === "c" || s.startsWith("couple") || s.startsWith("couples")) return "c";
  if (s === "l" || s.startsWith("lgbt") || s.startsWith("gay") || s.startsWith("bi")) return "l";
  if (s === "u" || s === "unknown" || s === "everyone" || s === "all" || s === "*") return "u";
  return "u";
}

function csvToArray(s: string | null | undefined): string[] {
  if (!s) return [];
  return String(s).split(",").map((x) => x.trim()).filter(Boolean);
}

export async function getTicketAttrs(ticket: string): Promise<TicketAttrs | null> {
  const h = await hgetallObj(ATTR_KEY(ticket));
  if (!h) return null;
  const selfCountry = h.selfCountry ? String(h.selfCountry).toUpperCase() : null;
  const genders = csvToArray(h.filterGendersCSV).map(normalizeGender).filter(Boolean) as GenderNorm[];
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

function elapsedLevel(elapsedMs: number): 0 | 1 | 2 | 3 | 4 {
  if (elapsedMs < 3000) return 0;
  if (elapsedMs < 8000) return 1;
  if (elapsedMs < 12000) return 2;
  if (elapsedMs < 20000) return 3;
  return 4;
}

type ScoreTuple = [number, number, number, number]; // (hardFlag, genderRank, countryRank, recencyRank)

function indexOfOrInf<T>(arr: T[] | null | undefined, v: T): number {
  if (!arr || arr.length === 0) return Number.POSITIVE_INFINITY;
  const i = arr.indexOf(v);
  return i >= 0 ? i : Number.POSITIVE_INFINITY;
}

function jitter(seed: string): number {
  // simple xorshift-like hash to produce stable [-0.2..+0.2]
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  const x = (h >>> 0) / 0xffffffff;
  return (x - 0.5) * 0.4; // [-0.2, +0.2]
}

function hardOK(me: TicketAttrs, other: TicketAttrs): boolean {
  const meG = me.filterGenders;
  const otherG = other.filterGenders;
  const meC = me.filterCountries;
  const otherC = other.filterCountries;

  const meAcceptsGender   = meG.length === 0 || meG.includes(other.selfGender);
  const otherAcceptsGender= otherG.length === 0 || otherG.includes(me.selfGender);

  const meAcceptsCountry  = meC.length === 0 || (other.selfCountry ? meC.includes(other.selfCountry) : false);
  const otherAcceptsCountry = otherC.length === 0 || (me.selfCountry ? otherC.includes(me.selfCountry) : false);

  return meAcceptsGender && otherAcceptsGender && meAcceptsCountry && otherAcceptsCountry;
}

function allowedByWiden(level: 0|1|2|3|4, me: TicketAttrs, other: TicketAttrs): boolean {
  const meG = me.filterGenders;
  const otherG = other.filterGenders;
  const meC = me.filterCountries;
  const otherC = other.filterCountries;

  const genderMutual = (meG.length === 0 || meG.includes(other.selfGender)) &&
                       (otherG.length === 0 || otherG.includes(me.selfGender));
  const countryMutual = (meC.length === 0 || (other.selfCountry ? meC.includes(other.selfCountry) : false)) &&
                        (otherC.length === 0 || (me.selfCountry ? otherC.includes(me.selfCountry) : false));

  if (level === 0 || level === 1) {
    return genderMutual && countryMutual; // hard only
  }
  if (level === 2) {
    return genderMutual; // relax country
  }
  if (level === 3) {
    if (genderMutual && countryMutual) return true;
    if (genderMutual) return true;
    const meBlocksG = meG.length > 0 && !meG.includes(other.selfGender);
    const otherBlocksG = otherG.length > 0 && !otherG.includes(me.selfGender);
    return !(meBlocksG || otherBlocksG);
  }
  return false;
}

function computeScore(level: 0|1|2|3|4, me: TicketAttrs, other: TicketAttrs): ScoreTuple | null {
  if (!allowedByWiden(level, me, other)) return null;

  const genderOrder = me.filterGenders;
  const countryOrder = me.filterCountries;

  const genderRank = genderOrder.length === 0 ? Number.POSITIVE_INFINITY : indexOfOrInf(genderOrder, other.selfGender);
  let countryRank: number;
  if (countryOrder.length === 0) {
    countryRank = other.selfCountry && me.selfCountry && other.selfCountry === me.selfCountry ? 0 : 1;
    countryRank = countryRank + jitter(`${me.ticket}|${other.ticket}`);
  } else {
    countryRank = indexOfOrInf(countryOrder, other.selfCountry as any);
  }

  const recencyRank = -other.ts;
  const hardFlag = hardOK(me, other) ? 0 : 1;
  return [hardFlag, genderRank, countryRank, recencyRank];
}

function roomNameFor(a: string, b: string): string {
  const short = Date.now().toString(36).slice(-5);
  return `pair-${short}-${a.slice(-3)}${b.slice(-3)}`;
}

async function claimBoth(me: string, other: string, ttlMs: number, room: string): Promise<boolean> {
  const locked = await setNX(LOCK_KEY(other), me, 4000);
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

function lexLess(a: ScoreTuple, b: ScoreTuple): boolean {
  for (let i = 0; i < 4; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

export async function tryMatch(ticket: string, now = Date.now()): Promise<MatchResult | null> {
  const me = await getTicketAttrs(ticket);
  if (!me) return null;
  const elapsed = now - me.ts;
  const level = elapsedLevel(elapsed);
  if (level === 4) {
    return null;
  }

  // dynamic sampling by queue size
  const zcount = await zcard(Q_KEY);
  const PAGE = 64;
  let target = PAGE;
  if (zcount > 2000) target = 256;
  else if (zcount > 200) target = 128;
  else target = 64;

  const minScore = now - TTL_MS;
  const maxScore = now;
  let collected: string[] = [];
  let offset = 0;
  while (collected.length < target && offset < 1024) {
    const batch = await zrangebyscore(Q_KEY, minScore, maxScore, offset, PAGE);
    if (!batch || batch.length === 0) break;
    for (const t of batch) {
      if (t && t !== ticket) collected.push(t);
      if (collected.length >= target) break;
    }
    offset += PAGE;
  }

  if (collected.length === 0) return null;

  // fetch attributes for candidates in pipeline (HGETALL, EXISTS) repeated
  const cmds: Cmd[] = [];
  for (const t of collected) {
    cmds.push(["HGETALL", ATTR_KEY(t)]);
    cmds.push(["EXISTS", ROOM_KEY(t)]);
  }
  const res = await redisPipeline(cmds);

  let best: { ticket: string; score: ScoreTuple } | null = null;

  for (let i = 0; i < collected.length; i++) {
    const h = res[i * 2];
    const ex = res[i * 2 + 1];
    if (!h) continue;
    const already = Number(ex) > 0;
    if (already) continue;
    const data: Record<string, string> =
      Array.isArray(h)
        ? (() => {
            const obj: Record<string, string> = {};
            for (let j = 0; j < h.length; j += 2) obj[String(h[j])] = String(h[j + 1] ?? "");
            return obj;
          })()
        : (h as Record<string, string>);

    const other: TicketAttrs = {
      ticket: collected[i],
      identity: String(data.identity || ""),
      deviceId: String(data.deviceId || ""),
      selfGender: normalizeGender(data.selfGender || "u"),
      selfCountry: data.selfCountry ? String(data.selfCountry).toUpperCase() : null,
      filterGenders: csvToArray(data.filterGendersCSV).map(normalizeGender) as GenderNorm[],
      filterCountries: csvToArray(data.filterCountriesCSV).map((x) => x.toUpperCase()),
      vip: !!(+String(data.vip || "0")),
      ts: Number(data.ts || now),
    };
    const sc = computeScore(level, me, other);
    if (!sc) continue;
    if (!best || lexLess(sc, best.score)) {
      best = { ticket: collected[i], score: sc };
    }
  }

  if (!best) return null;

  const room = roomNameFor(ticket, best.ticket);
  const ok = await claimBoth(ticket, best.ticket, TTL_MS, room);
  if (!ok) return null;
  return { room, matchedWith: best.ticket };
}
