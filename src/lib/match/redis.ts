// src/lib/match/redis.ts
import crypto from "node:crypto";

export type Gender = "all" | "male" | "female";
export type Entry = {
  ticket: string;
  identity: string;
  deviceId: string;
  vip: boolean;
  selfGender: "male" | "female" | "u";
  selfCountry: string | null;
  filterGenders: Gender;
  filterCountries: string[];
  ts: number;
};

const TTL_SEC = parseInt(process.env.MATCH_TTL_SEC || "", 10) || 45;

// Upstash env
const URL = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

// Public env guards
export function haveRedisEnv() {
  return !!URL && !!TOKEN;
}
function assertEnv() {
  if (!URL || !TOKEN) {
    throw new Error(
      "UPSTASH env missing: " +
        JSON.stringify({ hasUrl: !!URL, hasToken: !!TOKEN })
    );
  }
}

// REST helpers
async function rc(cmd: (string | number)[]): Promise<any> {
  assertEnv();
  const r = await fetch(URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(cmd.map(String)),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`redis ${cmd[0]} failed: ${r.status}`);
  const j = await r.json();
  return j?.result;
}
async function rcp(commands: (string | number)[][]): Promise<any[]> {
  assertEnv();
  const r = await fetch(URL + "/pipeline", {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ commands: commands.map(a => a.map(String)) }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`redis pipeline failed: ${r.status}`);
  const j = await r.json();
  return Array.isArray(j?.results) ? j.results.map((x: any) => x.result) : [];
}

// keys
const KQ = "mq:q";                             // ZSET: ts -> ticket
const KATTR = (t: string) => `mq:attr:${t}`;   // JSON per ticket
const KROOM = (t: string) => `mq:room:${t}`;   // room per ticket
const KDEV = (d: string) => `mq:dev:${d}`;     // deviceId -> ticket

// utils
const now = () => Date.now();
const parseJSON = <T,>(s: any): T | null => {
  try { return s ? JSON.parse(String(s)) as T : null; } catch { return null; }
};
function stableRoom(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  const short = crypto.createHash("sha1").update(x + ":" + y).digest("hex").slice(0, 8);
  return `pair-${short}-${x.slice(0,4)}${y.slice(0,4)}`;
}

// ===== API =====
export async function enqueue(entry: Omit<Entry, "ticket" | "ts">): Promise<{ ticket: string }> {
  const devKey = KDEV(entry.deviceId);
  const existing: string | null = await rc(["GET", devKey]);
  if (existing) {
    const [attrStr, room] = await rcp([["GET", KATTR(existing)], ["GET", KROOM(existing)]]);
    if (attrStr && !room) {
      const updated: Entry = {
        ticket: existing,
        identity: entry.identity,
        deviceId: entry.deviceId,
        vip: !!entry.vip,
        selfGender: entry.selfGender,
        selfCountry: entry.selfCountry ?? null,
        filterGenders: entry.filterGenders,
        filterCountries: entry.filterCountries || [],
        ts: now(),
      };
      await rcp([
        ["SET", KATTR(existing), JSON.stringify(updated), "EX", TTL_SEC],
        ["EXPIRE", devKey, TTL_SEC.toString()],
        ["ZADD", KQ, updated.ts.toString(), existing],
      ]);
      return { ticket: existing };
    }
  }

  const ticket = crypto.randomUUID();
  const full: Entry = {
    ticket,
    identity: entry.identity,
    deviceId: entry.deviceId,
    vip: !!entry.vip,
    selfGender: entry.selfGender,
    selfCountry: entry.selfCountry ?? null,
    filterGenders: entry.filterGenders,
    filterCountries: entry.filterCountries || [],
    ts: now(),
  };
  await rcp([
    ["SET", KATTR(ticket), JSON.stringify(full), "EX", TTL_SEC],
    ["SET", devKey, ticket, "EX", TTL_SEC],
    ["ZADD", KQ, full.ts.toString(), ticket],
  ]);
  return { ticket };
}

function accepts(a: Entry, b: Entry): boolean {
  const genderOk =
    a.filterGenders === "all" || (b.selfGender !== "u" && a.filterGenders === b.selfGender);
  const countryOk =
    a.filterCountries.length === 0 ||
    (!!b.selfCountry && a.filterCountries.includes(b.selfCountry.toUpperCase()));
  return genderOk && countryOk;
}

export async function tryMatch(
  ticket: string,
  widen: boolean
): Promise<{ room?: string } | null> {
  const myAttrStr = await rc(["GET", KATTR(ticket)]);
  if (!myAttrStr) return null;
  const me = parseJSON<Entry>(myAttrStr)!;

  // already paired?
  const existing = await rc(["GET", KROOM(ticket)]);
  if (existing) return { room: existing };

  // purge old by score
  const cutoff = now() - TTL_SEC * 1000;
  const old = await rc(["ZRANGEBYSCORE", KQ, "-inf", String(cutoff)]);
  if (Array.isArray(old) && old.length) await rc(["ZREM", KQ, ...old]);

  // FIFO scan
  const head = await rc(["ZRANGE", KQ, "0", "199"]);
  const candidates: string[] = Array.isArray(head) ? head : [];
  for (const cand of candidates) {
    if (!cand || cand === ticket) continue;
    const [cAttrStr, cRoom] = await rcp([["GET", KATTR(cand)], ["GET", KROOM(cand)]]);
    if (!cAttrStr || cRoom) continue;
    const other = parseJSON<Entry>(cAttrStr)!;
    const ok = widen ? true : (accepts(me, other) && accepts(other, me));
    if (!ok) continue;

    const room = stableRoom(ticket, cand);
    await rcp([
      ["SET", KROOM(ticket), room, "EX", TTL_SEC],
      ["SET", KROOM(cand), room, "EX", TTL_SEC],
      ["ZREM", KQ, ticket, cand],
    ]);
    return { room };
  }

  // ensure present in queue
  await rc(["ZADD", KQ, "NX", String(now()), ticket]);
  return null;
}

export async function getRoom(ticket: string): Promise<string | null> {
  const r = await rc(["GET", KROOM(ticket)]);
  return r || null;
}

export async function purge(): Promise<number> {
  const cutoff = now() - TTL_SEC * 1000;
  const old = (await rc(["ZRANGEBYSCORE", KQ, "-inf", String(cutoff)])) as string[] | null;
  let removed = 0;
  if (old && old.length) {
    await rc(["ZREM", KQ, ...old]);
    removed += old.length;
  }
  const head = (await rc(["ZRANGE", KQ, "0", "199"])) as string[] | null;
  if (head) {
    for (const t of head) {
      const a = await rc(["GET", KATTR(t)]);
      if (!a) { await rc(["ZREM", KQ, t]); removed++; }
    }
  }
  return removed;
}

export async function ping(): Promise<{ ok: boolean }> {
  await rc(["PING"]);
  return { ok: true };
}
