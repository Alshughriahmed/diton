// src/lib/match/redis.ts
import crypto from "node:crypto";

/* ======================= Types ======================= */
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

/* ======================= ENV / Consts ======================= */
const TTL_SEC = parseInt(process.env.MATCH_TTL_SEC || "", 10) || 45;

const URL = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

/** تستخدمها مسارات API للتحقق السريع قبل النداء */
export function haveRedisEnv() {
  return !!URL && !!TOKEN;
}
function assertEnv() {
  if (!URL || !TOKEN) {
    throw new Error(
      "UPSTASH env missing: " + JSON.stringify({ hasUrl: !!URL, hasToken: !!TOKEN })
    );
  }
}

/* ======================= Upstash REST helpers ======================= */
async function rc(cmd: (string | number)[]): Promise<any> {
  assertEnv();
  const r = await fetch(URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ command: cmd.map(String) }), // شكل صحيح لـ Upstash
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
    body: JSON.stringify({ commands: commands.map((a) => a.map(String)) }), // شكل صحيح
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`redis pipeline failed: ${r.status}`);
  const j = await r.json();
  const arr = Array.isArray(j?.results) ? j.results : [];
  return arr.map((x: any) => x?.result);
}

/* ======================= Keys ======================= */
const KQ = "mq:q"; // ZSET: ts -> ticket
const KATTR = (t: string) => `mq:attr:${t}`; // JSON per ticket
const KROOM = (t: string) => `mq:room:${t}`; // room per ticket
const KDEV = (d: string) => `mq:dev:${d}`; // deviceId -> ticket (للمعلومات فقط)

/* ======================= Utils ======================= */
const now = () => Date.now();

function parseJSON<T>(s: any): T | null {
  try {
    if (!s) return null;
    return typeof s === "string" ? (JSON.parse(s) as T) : (s as T);
  } catch {
    return null;
  }
}

function stableRoom(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  const short = crypto.createHash("sha1").update(x + ":" + y).digest("hex").slice(0, 8);
  return `pair-${short}-${x.slice(0, 4)}${y.slice(0, 4)}`;
}

/* ======================= Public API ======================= */

/**
 * دائمًا ينشئ تذكرة جديدة. لا يعيد استخدام تذاكر الأجهزة.
 */
export async function enqueue(
  entry: Omit<Entry, "ticket" | "ts">
): Promise<{ ticket: string }> {
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
    ["SET", KDEV(entry.deviceId), ticket], // للمرجعة فقط
    ["EXPIRE", KDEV(entry.deviceId), TTL_SEC],
    ["ZADD", KQ, full.ts.toString(), ticket],
  ]);

  return { ticket };
}

function accepts(a: Entry, b: Entry): boolean {
  const genderOk =
    a.filterGenders === "all" ||
    (b.selfGender !== "u" && a.filterGenders === b.selfGender);
  const countryOk =
    a.filterCountries.length === 0 ||
    (!!b.selfCountry && a.filterCountries.includes(b.selfCountry.toUpperCase()));
  return genderOk && countryOk;
}

/**
 * يحاول مطابقة تذكرة. إذا widen=true يتساهل بالقبول FIFO.
 */
export async function tryMatch(
  ticket: string,
  widen: boolean
): Promise<{ room?: string } | null> {
  // صفاتي
  const myAttrStr = await rc(["GET", KATTR(ticket)]);
  if (!myAttrStr) return null;
  const me = parseJSON<Entry>(myAttrStr)!;

  // سبق وتمت خريطته لغرفة؟
  const existing = await rc(["GET", KROOM(ticket)]);
  if (existing) return { room: existing as string };

  // تنظيف قديم في الـ ZSET
  const cutoff = now() - TTL_SEC * 1000;
  const old = (await rc(["ZRANGEBYSCORE", KQ, "-inf", String(cutoff)])) as string[] | null;
  if (Array.isArray(old) && old.length) {
    await rc(["ZREM", KQ, ...old]);
  }

  // فحص المرشحين FIFO (مع الدرجات)
  const zRaw = (await rc(["ZRANGE", KQ, "0", "199", "WITHSCORES"])) as any[] | null;
  const z: any[] = Array.isArray(zRaw) ? zRaw : [];
  for (let i = 0; i < z.length; i += 2) {
    const candT = String(z[i] ?? "");
    const ts = Number(z[i + 1] ?? 0);
    if (!candT || candT === ticket) continue;
    if (ts < cutoff) continue;

    const [cAttrStr, cRoom] = await rcp([
      ["GET", KATTR(candT)],
      ["GET", KROOM(candT)],
    ]);
    if (!cAttrStr || cRoom) continue;

    const other = parseJSON<Entry>(cAttrStr);
    if (!other) continue;

    const ok = widen ? true : accepts(me, other) && accepts(other, me);
    if (!ok) continue;

    // احجز غرفة ثابتة للطرفين ثم أخرج من الصف
    const room = stableRoom(ticket, candT);
    await rcp([
      ["SET", KROOM(ticket), room],
      ["EXPIRE", KROOM(ticket), TTL_SEC],
      ["SET", KROOM(candT), room],
      ["EXPIRE", KROOM(candT), TTL_SEC],
      ["ZREM", KQ, ticket, candT],
    ]);
    return { room };
  }

  // أعِد تأكيد وجودي في الصف مع آخر طابع زمني
  await rc(["ZADD", KQ, "NX", String(now()), ticket]);
  return null;
}

export async function getRoom(ticket: string): Promise<string | null> {
  const r = await rc(["GET", KROOM(ticket)]);
  return (r as string) || null;
}

export async function purge(): Promise<number> {
  const cutoff = now() - TTL_SEC * 1000;
  let removed = 0;

  // أزل القديمة من الـ ZSET
  const old = (await rc(["ZRANGEBYSCORE", KQ, "-inf", String(cutoff)])) as string[] | null;
  if (Array.isArray(old) && old.length) {
    await rc(["ZREM", KQ, ...old]);
    removed += old.length;
  }

  // تحقق من رؤوس الصف التي فقدت صفاتها
  const head = (await rc(["ZRANGE", KQ, "0", "199"])) as string[] | null;
  const list = Array.isArray(head) ? head : [];
  for (const t of list) {
    const a = await rc(["GET", KATTR(t)]);
    if (!a) {
      await rc(["ZREM", KQ, t]);
      removed++;
    }
  }

  return removed;
}

export async function ping(): Promise<{ ok: boolean }> {
  await rc(["PING"]);
  return { ok: true };
}
