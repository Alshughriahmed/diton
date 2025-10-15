// src/lib/match/redis.ts

// ===== Types =====
export type EnqueueInput = {
  identity: string;
  deviceId: string;
  selfGender?: string | null;
  selfCountry?: string | null;
  filterGenders?: string[] | null;
  filterCountries?: string[] | null;
  vip?: boolean | null;
};

type Attr = {
  identity: string;
  deviceId: string;
  selfGender?: string | null;
  selfCountry?: string | null;
  filterGenders?: string[] | null;
  filterCountries?: string[] | null;
  vip?: boolean | null;
  ts: number;
};

// ===== Consts =====
const TTL_MS = 45_000;
const Q_KEY = "mq:q";
const DEV = (d: string) => `mq:dev:${d}`;
const ATTR = (t: string) => `mq:attr:${t}`;
const ROOM = (t: string) => `mq:room:${t}`;

// ===== ENV helpers =====
export function haveRedisEnv(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash ENV missing");
  return { url, token };
}

// ===== Low-level REST helpers (Upstash REST v2) =====
async function rpost<T = any>(path: string, body: any) {
  const { url, token } = getRedis();
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`redis ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}
async function cmd<T = any>(...args: (string | number)[]) {
  const a = args.map((x) => (typeof x === "number" ? String(x) : x));
  return rpost<T>("/", a);
}
async function pipeline(cmds: (string | number)[][]) {
  const arr = cmds.map((c) => c.map((x) => (typeof x === "number" ? String(x) : x)));
  return rpost<any[]>("/pipeline", arr);
}

// ===== Utils =====
const now = () => Date.now();
const toCSV = (a?: string[] | null) => (Array.isArray(a) ? a.join(",") : "");
const fromCSV = (s?: string | null) => (s || "").split(",").filter(Boolean);
function ticketId(): string {
  const t = now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `t-${t}-${r}`;
}
function roomId(a: string, b: string) {
  const t = now().toString(36).slice(-4);
  const A = a.slice(0, 4);
  const B = b.slice(0, 4);
  return `pair-${t}-${A}${B}`;
}

// ===== Public API =====
export async function enqueue(input: EnqueueInput) {
  const ts = now();
  const devKey = DEV(input.deviceId);

  // Reuse device ticket if warm
  const devGet = await cmd<{ result: string | null }>("GET", devKey);
  let ticket = devGet?.result || "";
  if (!ticket) ticket = ticketId();

  const attr: Attr = {
    identity: input.identity,
    deviceId: input.deviceId,
    selfGender: input.selfGender || null,
    selfCountry: input.selfCountry || null,
    filterGenders: input.filterGenders || null,
    filterCountries: input.filterCountries || null,
    vip: !!input.vip,
    ts,
  };
  const attrKey = ATTR(ticket);

  const p: (string | number)[][] = [
    [
      "HSET",
      attrKey,
      "identity",
      attr.identity,
      "deviceId",
      attr.deviceId,
      "selfGender",
      attr.selfGender || "",
      "selfCountry",
      attr.selfCountry || "",
      "filterGenders",
      toCSV(attr.filterGenders),
      "filterCountries",
      toCSV(attr.filterCountries),
      "vip",
      attr.vip ? "1" : "0",
      "ts",
      String(attr.ts),
    ],
    ["PEXPIRE", attrKey, TTL_MS],
    ["ZADD", Q_KEY, "NX", ts, ticket],
    ["SET", devKey, ticket, "PX", TTL_MS],
  ];
  const rsp = await pipeline(p);
  const zaddOk = rsp[2] && !rsp[2].error;
  if (!zaddOk) throw new Error(`enqueue ZADD error: ${rsp[2]?.error || "unknown"}`);
  return { ticket };
}

export async function getRoom(ticket: string) {
  const r = await cmd<{ result: string | null }>("GET", ROOM(ticket));
  return r?.result || null;
}

export async function tryMatch(ticket: string, widen: boolean) {
  // Already assigned?
  const existing = await getRoom(ticket);
  if (existing) return existing;

  const me = await readAttr(ticket);
  if (!me) return null;

  const tNow = now();
  const min = tNow - TTL_MS;

  // FIFO-ish: recent window
  const zr = await cmd<{ result: string[] | null }>("ZRANGEBYSCORE", Q_KEY, min, tNow);
  const candidates = (zr?.result || []).filter((t) => t !== ticket);
  if (!candidates.length) return null;

  // Bulk-read candidate attrs
  const cmds = candidates.slice(0, 64).map((t) => [
    "HMGET",
    ATTR(t),
    "identity",
    "deviceId",
    "selfGender",
    "selfCountry",
    "filterGenders",
    "filterCountries",
    "vip",
    "ts",
  ]);
  const res = cmds.length ? await pipeline(cmds) : [];
  for (let i = 0; i < res.length; i++) {
    if (res[i]?.error) continue;
    const v = res[i]?.result as (string | null)[];
    if (!v) continue;

    const other: Attr = {
      identity: v[0] || "",
      deviceId: v[1] || "",
      selfGender: v[2] || "",
      selfCountry: v[3] || "",
      filterGenders: fromCSV(v[4]),
      filterCountries: fromCSV(v[5]),
      vip: v[6] === "1",
      ts: Number(v[7] || "0"),
    };
    const otherTicket = candidates[i];
    if (!other.identity) continue;

    // Skip if the other already has a room
    const otherRoom = await cmd<{ result: string | null }>("GET", ROOM(otherTicket));
    if (otherRoom?.result) continue;

    if (!matchOK(me, other, widen)) continue;

    // Commit match
    const room = roomId(ticket, otherTicket);
    const commit: (string | number)[][] = [
      ["SET", ROOM(ticket), room, "PX", TTL_MS],
      ["SET", ROOM(otherTicket), room, "PX", TTL_MS],
      ["ZREM", Q_KEY, ticket],
      ["ZREM", Q_KEY, otherTicket],
    ];
    const rc = await pipeline(commit);
    const ok = !rc[0]?.error && !rc[1]?.error && (rc[2]?.result ?? 0) >= 0 && (rc[3]?.result ?? 0) >= 0;
    if (ok) return room;
  }
  return null;
}

// ===== Internals =====
async function readAttr(ticket: string): Promise<Attr | null> {
  const a = await cmd<{ result: (string | null)[] | null }>(
    "HMGET",
    ATTR(ticket),
    "identity",
    "deviceId",
    "selfGender",
    "selfCountry",
    "filterGenders",
    "filterCountries",
    "vip",
    "ts"
  );
  const v = a?.result;
  if (!v || v.every((x) => x === null)) return null;
  return {
    identity: v[0] || "",
    deviceId: v[1] || "",
    selfGender: v[2] || "",
    selfCountry: v[3] || "",
    filterGenders: fromCSV(v[4]),
    filterCountries: fromCSV(v[5]),
    vip: v[6] === "1",
    ts: Number(v[7] || "0"),
  };
}

function matchOK(me: Attr, other: Attr, widen: boolean) {
  if (widen) return true;

  const meG = me.filterGenders?.length ? me.filterGenders : null;
  const meC = me.filterCountries?.length ? me.filterCountries : null;
  const otG = other.selfGender || "";
  const otC = other.selfCountry || "";

  const otherG = other.filterGenders?.length ? other.filterGenders : null;
  const otherC = other.filterCountries?.length ? other.filterCountries : null;
  const myG = me.selfGender || "";
  const myC = me.selfCountry || "";

  const gOK = (!meG || meG.includes(otG)) && (!otherG || otherG.includes(myG));
  const cOK = (!meC || meC.includes(otC)) && (!otherC || otherC.includes(myC));

  return gOK && cOK;
}
