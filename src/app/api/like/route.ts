import { jsonEcho } from "@/lib/api/xreq";
// runtime: Node لقراءة مفاتيح Upstash
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOK_ = process.env.UPSTASH_REDIS_REST_TOKEN;

type UpstashItem = { result: any };
async function redis(cmds: any[]): Promise<UpstashItem[]> {
  if (!URL_ || !TOK_) throw new Error("UPSTASH_ENV_MISSING");
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK_}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`UPSTASH_FAIL_${r.status}`);
  return r.json();
}

/* LIKE_IDEMP_ENABLED */
const __like_mem = new Map<string, number>();
const IDEMP_TTL_SEC = 600;

async function idempCheckAndSet(req: Request, userScope: string) {
  const hdr = req.headers.get("x-idempotency") || "";
  const key = hdr ? `like:idemp:${userScope}:${hdr}` : "";
  if (!key) return { duplicate:false, key:"" };

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    if (url && tok) {
      const getRes = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${tok}` }, cache: "no-store" });
      const getJson: any = await getRes.json().catch(()=>({}));
      if (getJson?.result) return { duplicate:true, key };
      await fetch(`${url}/set/${encodeURIComponent(key)}/1?EX=${IDEMP_TTL_SEC}`, { headers: { Authorization: `Bearer ${tok}` }, cache: "no-store" });
      return { duplicate:false, key };
    }
  } catch {}

  const now = Date.now();
  const exp = __like_mem.get(key) || 0;
  if (exp > now) return { duplicate:true, key };
  __like_mem.set(key, now + IDEMP_TTL_SEC*1000);
  return { duplicate:false, key };
}

async function userScopeFromReq(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const m = cookie.match(/(anon|aid|__did|sessionId)=([^;]+)/);
    if (m) return m[2];
  } catch {}
  return "anon";
}

const JSON_NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
function j(body:any, init?: number | { status?: number }) {
  const status = typeof init === "number" ? init : (init?.status ?? 200);
  
    const res = __noStore(jsonEcho( body, { status }));
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;

}

const kCount = (p: string) => `likes:count:${p}`;
const kWho   = (p: string) => `likes:who:${p}`;
const RL_MAX = 8; const RL_WIN = 10; const rlKey = (p:string,a:string)=>`likes:rl:${p}:${a}`;


function parseAnon(req: NextRequest){
  return (
    req.headers.get("x-anon") ||
    req.cookies.get("anon")?.value ||
    req.cookies.get("ditona_anon")?.value ||
    ""
  );
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const pairId = sp.get("pairId");
  if (!pairId) return j({ error: "pairId required" }, { status: 400 });

  const anon = parseAnon(req) || "";
  const res = await redis([
    ["GET", kCount(pairId)],
    ["SISMEMBER", kWho(pairId), anon],
  ]);

  const count = Number(res?.[0]?.result ?? 0);
  const you = !!(res?.[1]?.result ?? false);
  return j({ count: Number.isFinite(count) ? count : 0, you });
}

async function POST_IMPL(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  let pairId = sp.get("pairId");
  let op = (sp.get("op") || "inc").toLowerCase();
  
  // Also check request body for modern usage
  try {
    const body = await req.json();
    if (!pairId && body.pairId) pairId = body.pairId;
    if (body.action === 'like') op = 'inc';
    if (body.action === 'unlike') op = 'dec';
  } catch {}
  
  if (!pairId) return j({ error: "pairId required" }, { status: 400 });

  const anon = parseAnon(req);
  if (!anon) return j({ error: "x-anon or anon cookie required" }, { status: 400 });

  if (op === "inc") {
    { const rk=rlKey(pairId, anon); const r=await redis([["INCR", rk], ["EXPIRE", rk, String(RL_WIN), "NX"]]); const hits=Number(r?.[0]?.result ?? 0); if (hits > RL_MAX) { return j({ error: "rate_limited", hits, window: RL_WIN }, 429); } }

    const add = await redis([["SADD", kWho(pairId), anon]]);
    const added = Number(add?.[0]?.result ?? 0) === 1;
    if (added) {
      const inc = await redis([["INCR", kCount(pairId)]]);
      const count = Number(inc?.[0]?.result ?? 0);
      return j({ ok: true, count, you: true });
    } else {
      const get = await redis([["GET", kCount(pairId)]]);
      const count = Number(get?.[0]?.result ?? 0);
      return j({ ok: true, count, you: true });
    }
  } else if (op === "dec") {
    { const rk=rlKey(pairId, anon); const r=await redis([["INCR", rk], ["EXPIRE", rk, String(RL_WIN), "NX"]]); const hits=Number(r?.[0]?.result ?? 0); if (hits > RL_MAX) { return j({ error: "rate_limited", hits, window: RL_WIN }, 429); } }

    const rem = await redis([["SREM", kWho(pairId), anon]]);
    const removed = Number(rem?.[0]?.result ?? 0) === 1;
    if (removed) {
      const decr = await redis([["DECR", kCount(pairId)]]);
      let count = Number(decr?.[0]?.result ?? 0);
      if (!Number.isFinite(count) || count < 0) {
        await redis([["SET", kCount(pairId), "0"]]);
        count = 0;
      }
      return j({ ok: true, count, you: false });
    } else {
      const get = await redis([["GET", kCount(pairId)]]);
      const count = Number(get?.[0]?.result ?? 0);
      return j({ ok: true, count, you: false });
    }
  }
  return j({ error: "op must be inc or dec" }, { status: 400 });
}

export async function POST(req: NextRequest, ctx: any) {
  const scope = await userScopeFromReq(req);
  const r = await idempCheckAndSet(req, scope);
  if (r.duplicate) {
    return __noStore(new Response(JSON.stringify({ ok:true, duplicate:true }), { status:200, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" } }));
  }
  const res: any = await (POST_IMPL as any)(req, ctx);
  try { res.headers?.set?.("Cache-Control","no-store"); } catch {}
  return res;
}

