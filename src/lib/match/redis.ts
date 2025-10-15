// src/lib/match/redis.ts
/* Runtime: node. No new ENV. */
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;
if (!REDIS_URL || !REDIS_TOKEN) throw new Error("Missing Upstash ENV");

type EnqueueInput = {
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
  filterGenders?: string[];
  filterCountries?: string[];
  vip?: boolean | null;
  ts: number;
};

const TTL_MS = 45_000;
const Q_KEY = "mq:q";
const DEV = (d: string) => `mq:dev:${d}`;
const ATTR = (t: string) => `mq:attr:${t}`;
const ROOM = (t: string) => `mq:room:${t}`;

async function rpost<T = any>(path: string, body: any) {
  const res = await fetch(`${REDIS_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // never cache
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`redis ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

async function cmd<T = any>(...args: (string | number)[]) {
  // Single command: POST / with JSON array
  const a = args.map((x) => (typeof x === "number" ? String(x) : x));
  return rpost<T>("/", a);
}

async function pipeline(cmds: (string | number)[][]) {
  // Pipeline: POST /pipeline with array of arrays
  const arr = cmds.map((c) => c.map((x) => (typeof x === "number" ? String(x) : x)));
  return rpost<any[]>("/pipeline", arr);
}

function now() {
  return Date.now();
}
function toCSV(a?: string[] | null) {
  return Array.isArray(a) ? a.join(",") : "";
}
function fromCSV(s?: string | null): string[] {
  return (s || "").split(",").filter(Boolean);
}
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

export async function enqueue(input: EnqueueInput) {
  const ts = now();
  const devKey = DEV(input.deviceId);

  // Reuse ticket per device if still warm
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

  // Build pipeline
  const p: (string | number)[][] = [
    // Attributes
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
    // Queue insert FIFO by timestamp
    ["ZADD", Q_KEY, "NX", ts, ticket],
    // Device → ticket mapping with TTL
    ["SET", devKey, ticket, "PX", TTL_MS],
  ];

  const rsp = await pipeline(p);
  // rsp is array of results; we validate the ZADD succeeded (index 2)
  const zaddOk = rsp[2]?.result !== null && rsp[2]?.error == null;
  if (!zaddOk && rsp[2]?.error) {
    throw new Error(`enqueue ZADD error: ${rsp[2].error}`);
  }
  return { ticket };
}

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

  const meG = (me.filterGenders && me.filterGenders.length) ? me.filterGenders : null;
  const meC = (me.filterCountries && me.filterCountries.length) ? me.filterCountries : null;
  const otG = other.selfGender || "";
  const otC = other.selfCountry || "";

  const otherG = (other.filterGenders && other.filterGenders.length) ? other.filterGenders : null;
  const otherC = (other.filterCountries && other.filterCountries.length) ? other.filterCountries : null;
  const myG = me.selfGender || "";
  const myC = me.selfCountry || "";

  const gOK = (!meG || meG.includes(otG)) && (!otherG || otherG.includes(myG));
  const cOK = (!meC || meC.includes(otC)) && (!otherC || otherC.includes(myC));

  return gOK && cOK;
}

export async function getRoom(ticket: string) {
  const r = await cmd<{ result: string | null }>("GET", ROOM(ticket));
  return r?.result || null;
}

export async function tryMatch(ticket: string, widen: boolean) {
  // Already assigned?
  const existing = await getRoom(ticket);
  if (existing) return existing;

  // Read my attr
  const me = await readAttr(ticket);
  if (!me) return null;

  const tNow = now();
  const min = tNow - TTL_MS;
  // Get recent tickets ascending by score
  const zr = await cmd<{ result: string[] | null }>("ZRANGEBYSCORE", Q_KEY, min, tNow);
  const candidates = (zr?.result || []).filter((t) => t !== ticket);
  if (!candidates.length) return null;

  // Fetch candidate attrs in pipeline
  const cmds: (string | number)[][] = candidates.slice(0, 64).map((t) => [
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
    const row = res[i];
    if (row?.error) continue;
    const v = row?.result as (string | null)[];
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

    // Commit: assign room for both and remove from queue
    const room = roomId(ticket, otherTicket);
    const commit: (string | number)[][] = [
      ["SET", ROOM(ticket), room, "PX", TTL_MS],
      ["SET", ROOM(otherTicket), room, "PX", TTL_MS],
      ["ZREM", Q_KEY, ticket],
      ["ZREM", Q_KEY, otherTicket],
    ];
    const rCommit = await pipeline(commit);
    const ok =
      !rCommit[0]?.error &&
      !rCommit[1]?.error &&
      (rCommit[2]?.result === 1 || rCommit[2]?.result === 0) &&
      (rCommit[3]?.result === 1 || rCommit[3]?.result === 0);
    if (ok) return room;
  }
  return null;
}
