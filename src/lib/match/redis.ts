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
const URL_RAW = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const URL = URL_RAW.replace(/\/+$/, ""); // trim trailing slash

export function haveRedisEnv() { return !!URL && !!TOKEN; }
function assertEnv() {
  if (!haveRedisEnv()) {
    throw new Error("UPSTASH env missing: " + JSON.stringify({ hasUrl: !!URL, hasToken: !!TOKEN }));
  }
}

/* ================= Helpers: HTTP clients مع فوالب متعددة ================= */
async function httpJSON<T>(input: RequestInfo, init: RequestInit): Promise<{ ok:boolean; status:number; body:any }> {
  const r = await fetch(input, init);
  let body: any = null;
  try { body = await r.json(); } catch { body = await r.text().catch(()=> ""); }
  return { ok: r.ok, status: r.status, body };
}

// 1) POST {command:[...]}  → fallback 2) GET ?q=...  → fallback 3) Path style /CMD/arg1/arg2
async function rc(cmd: (string | number)[]): Promise<any> {
  assertEnv();
  const args = cmd.map(String);

  // try JSON body
  let resp = await httpJSON(URL, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ command: args }),
    cache: "no-store",
  });
  if (!resp.ok && resp.status === 400) {
    // try legacy ?q=
    const q = encodeURIComponent(args.join(" "));
    resp = await httpJSON(`${URL}?q=${q}`, {
      method: "GET",
      headers: { authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
  }
  if (!resp.ok && resp.status === 400 && args.length >= 1) {
    // try path style /CMD/a/b
    const path = [args[0], ...args.slice(1).map(encodeURIComponent)].join("/");
    resp = await httpJSON(`${URL}/${path}`, {
      method: "GET",
      headers: { authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
  }

  if (!resp.ok) {
    const diag = typeof resp.body === "string" ? resp.body : JSON.stringify(resp.body);
    throw new Error(`redis ${args[0]} failed: ${resp.status} ${diag}`);
  }
  const b = resp.body;
  return b?.result ?? b?.results ?? b ?? null;
}

// pipeline: جرّب /pipeline، وإلا نفّذ بالتتابع rc()
async function rcp(commands: (string | number)[][]): Promise<any[]> {
  assertEnv();
  const cmds = commands.map(a => a.map(String));

  let resp = await httpJSON(`${URL}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ commands: cmds }),
    cache: "no-store",
  });

  if (!resp.ok && resp.status === 400) {
    // sequential fallback
    const out: any[] = [];
    for (const c of cmds) out.push(await rc(c));
    return out;
  }

  if (!resp.ok) {
    const diag = typeof resp.body === "string" ? resp.body : JSON.stringify(resp.body);
    throw new Error(`redis pipeline failed: ${resp.status} ${diag}`);
  }
  const b = resp.body;
  if (Array.isArray(b?.results)) return b.results.map((x: any) => x.result);
  if (Array.isArray(b)) return b;
  return [];
}

/* ================= Keys ================= */
const KQ = "mq:q";                        // ZSET ts -> ticket
const KATTR = (t: string) => `mq:attr:${t}`;
const KROOM = (t: string) => `mq:room:${t}`;
const KDEV  = (d: string) => `mq:dev:${d}`;

const now = () => Date.now();
const parseJSON = <T,>(s: any): T | null => { try { return s ? (typeof s === "string" ? JSON.parse(s) : s) as T : null; } catch { return null; } };
function stableRoom(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  const short = crypto.createHash("sha1").update(x + ":" + y).digest("hex").slice(0, 8);
  return `pair-${short}-${x.slice(0,4)}${y.slice(0,4)}`;
}

/* ================= Public API ================= */
export async function enqueue(entry: Omit<Entry, "ticket" | "ts">): Promise<{ ticket: string }> {
  const devKey = KDEV(entry.deviceId);

  // reuse device ticket if alive and not paired
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
        ["SET", KATTR(existing), JSON.stringify(updated)],
        ["EXPIRE", KATTR(existing), TTL_SEC],
        ["EXPIRE", devKey, TTL_SEC],
        ["ZADD", KQ, updated.ts.toString(), existing],
      ]);
      return { ticket: existing };
    }
  }

  // fresh ticket
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
    ["SET", KATTR(ticket), JSON.stringify(full)],
    ["EXPIRE", KATTR(ticket), TTL_SEC],
    ["SET", devKey, ticket],
    ["EXPIRE", devKey, TTL_SEC],
    ["ZADD", KQ, full.ts.toString(), ticket],
  ]);

  return { ticket };
}

function accepts(a: Entry, b: Entry): boolean {
  const genderOk = a.filterGenders === "all" || (b.selfGender !== "u" && a.filterGenders === b.selfGender);
  const countryOk = a.filterCountries.length === 0 || (!!b.selfCountry && a.filterCountries.includes(b.selfCountry.toUpperCase()));
  return genderOk && countryOk;
}

export async function tryMatch(ticket: string, widen: boolean): Promise<{ room?: string } | null> {
  const myAttrStr = await rc(["GET", KATTR(ticket)]);
  if (!myAttrStr) return null;
  const me = parseJSON<Entry>(myAttrStr)!;

  const existing = await rc(["GET", KROOM(ticket)]);
  if (existing) return { room: existing };

  const cutoff = now() - TTL_SEC * 1000;
  const old = await rc(["ZRANGEBYSCORE", KQ, "-inf", String(cutoff)]);
  if (Array.isArray(old) && old.length) await rc(["ZREM", KQ, ...old]);

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
      ["SET", KROOM(ticket), room], ["EXPIRE", KROOM(ticket), TTL_SEC],
      ["SET", KROOM(cand), room],   ["EXPIRE", KROOM(cand), TTL_SEC],
      ["ZREM", KQ, ticket, cand],
    ]);
    return { room };
  }

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
  if (old && old.length) { await rc(["ZREM", KQ, ...old]); removed += old.length; }
  const head = (await rc(["ZRANGE", KQ, "0", "199"])) as string[] | null;
  if (head) for (const t of head) { const a = await rc(["GET", KATTR(t)]); if (!a) { await rc(["ZREM", KQ, t]); removed++; } }
  return removed;
}

export async function ping(): Promise<{ ok: boolean }> { await rc(["PING"]); return { ok: true }; }
