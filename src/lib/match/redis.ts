// src/lib/match/redis.ts  (patch: add guards + ping/haveRedisEnv)
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
const URL = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

export function haveRedisEnv() {
  return !!URL && !!TOKEN;
}

function assertEnv() {
  if (!URL || !TOKEN) {
    const miss = { hasUrl: !!URL, hasToken: !!TOKEN };
    throw new Error("UPSTASH env missing: " + JSON.stringify(miss));
  }
}

// Upstash REST helper
async function rc(cmd: (string | number)[]): Promise<any> {
  assertEnv();
  const r = await fetch(URL, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
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
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ commands: commands.map(a => a.map(String)) }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`redis pipeline failed: ${r.status}`);
  const j = await r.json();
  return Array.isArray(j?.results) ? j.results.map((x: any) => x.result) : [];
}

// keys, utils, stableRoom ...  (اترك باقي الملف كما هو عندك)

export async function ping(): Promise<{ ok: boolean }> {
  await rc(["PING"]);
  return { ok: true };
}
