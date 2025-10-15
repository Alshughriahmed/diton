// src/lib/match/redis.ts
// Queue + matching over Upstash Redis (HTTP REST)

type Gender = "all" | "male" | "female";
export type EnqueueBody = {
  identity: string;
  deviceId: string;
  vip: boolean;
  selfGender: "male" | "female" | "u";
  selfCountry: string | null;
  filterGenders: Gender;
  filterCountries: string[]; // [] => ALL
};

const RURL = process.env.UPSTASH_REDIS_REST_URL!;
const RTOK = process.env.UPSTASH_REDIS_REST_TOKEN!;

export function haveRedisEnv() {
  return !!RURL && !!RTOK;
}

async function rget<T = unknown>(cmd: string[], fallback: T | null = null): Promise<T | null> {
  const r = await fetch(RURL, {
    method: "POST",
    headers: { authorization: `Bearer ${RTOK}`, "content-type": "application/json" },
    body: JSON.stringify({ pipeline: [cmd] }),
    cache: "no-store",
  });
  if (!r.ok) return fallback;
  const j = (await r.json()) as { result: unknown }[];
  const v = j?.[0]?.result ?? null;
  return (v as T) ?? (fallback as any);
}
async function rpipe(cmds: string[][]) {
  await fetch(RURL, {
    method: "POST",
    headers: { authorization: `Bearer ${RTOK}`, "content-type": "application/json" },
    body: JSON.stringify({ pipeline: cmds }),
    cache: "no-store",
  }).catch(() => {});
}

/* keys */
const Q = "mq:q"; // ZSET ticket -> ts
const A = (t: string) => `mq:attr:${t}`; // HSET
const ROOM = (t: string) => `mq:room:${t}`; // STRING

const TTL = 60; // seconds

function acc(a: EnqueueBody, b: EnqueueBody, widen: boolean) {
  if (widen) return true;
  const gOk = a.filterGenders === "all" || (b.selfGender !== "u" && a.filterGenders === b.selfGender);
  const cOk =
    a.filterCountries.length === 0 ||
    (!!b.selfCountry && a.filterCountries.includes(String(b.selfCountry).toUpperCase()));
  return gOk && cOk;
}

/* ------------ public API ------------ */

export async function enqueue(entry: EnqueueBody, ticket?: string): Promise<string> {
  const t = ticket || crypto.randomUUID();

  const cmds: string[][] = [
    ["ZADD", Q, Date.now().toString(), t],
    ["EXPIRE", Q, TTL.toString()],
    // store attrs
    ["HSET", A(t),
      "identity", entry.identity,
      "deviceId", entry.deviceId,
      "vip", entry.vip ? "1" : "0",
      "selfGender", entry.selfGender,
      "selfCountry", entry.selfCountry ?? "",
      "filterGenders", entry.filterGenders,
      "filterCountries", JSON.stringify(entry.filterCountries ?? [])
    ],
    ["EXPIRE", A(t), TTL.toString()],
  ];
  await rpipe(cmds);
  return t;
}

export async function getRoom(ticket: string): Promise<string | null> {
  const v = await rget<{ result: string }>(["GET", ROOM(ticket)], null);
  if (typeof (v as any)?.result === "string") return (v as any).result;
  if (typeof (v as any) === "string") return v as any;
  return null;
}

export async function tryMatch(myTicket: string, widen: boolean): Promise<string | null> {
  // already paired?
  const exists = await getRoom(myTicket);
  if (exists) return exists;

  // get my attrs
  const my = await rget<string[]>(["HGETALL", A(myTicket)], null);
  if (!my || my.length === 0) return null;
  const myObj = hToObj(my);

 // scan queue in FIFO order
const now = Date.now();
const windowStart = now - TTL * 1000;

// WITHSCORES يرجع [member, score, member, score, ...] وقد تكون النتيجة null
const flat = await rget<string[] | null>(["ZRANGE", Q, "0", "-1", "WITHSCORES"], null);
const z: string[] = Array.isArray(flat) ? flat : [];

for (let i = 0; i < z.length; i += 2) {
  const t = String(z[i] ?? "");
  const ts = Number(z[i + 1] ?? NaN);
  if (!t || t === myTicket) continue;
  if (!Number.isFinite(ts) || ts < windowStart) continue;

    // skip if peer already paired
    const mapped = await getRoom(t);
    if (mapped) continue;

    const peerArr = await rget<string[]>(["HGETALL", A(t)], null);
    if (!peerArr || peerArr.length === 0) continue;
    const peer = hToObj(peerArr);

    if (acc(myObj, peer, widen) && acc(peer, myObj, widen)) {
      const room = stableRoom(myTicket, t);
      await rpipe([
        ["SET", ROOM(myTicket), room, "EX", TTL.toString()],
        ["SET", ROOM(t), room, "EX", TTL.toString()],
        ["ZREM", Q, myTicket],
        ["ZREM", Q, t],
      ]);
      return room;
    }
  }
  return null;
}

/* ------------ helpers ------------ */
function hToObj(arr: string[]): EnqueueBody {
  const o: any = {};
  for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return {
    identity: String(o.identity || ""),
    deviceId: String(o.deviceId || ""),
    vip: o.vip === "1",
    selfGender: (o.selfGender === "male" || o.selfGender === "female") ? o.selfGender : "u",
    selfCountry: o.selfCountry ? String(o.selfCountry) : null,
    filterGenders: (o.filterGenders === "male" || o.filterGenders === "female") ? o.filterGenders : "all",
    filterCountries: safeJSON(o.filterCountries, []),
  };
}
function safeJSON<T>(s: string, d: T): T {
  try { return JSON.parse(s); } catch { return d; }
}
function stableRoom(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `pair-${x.slice(0, 6)}${y.slice(0, 6)}`;
}
