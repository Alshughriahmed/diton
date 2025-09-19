// runtime: Node لقراءة مفاتيح Upstash
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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

const JSON_NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
function j(body:any, init?: number | { status?: number }) {
  const status = typeof init === "number" ? init : (init?.status ?? 200);
  
    const res = NextResponse.json(body, { status });
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

export async function POST(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const pairId = sp.get("pairId");
  const op = (sp.get("op") || "inc").toLowerCase();
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
export const dynamic="force-dynamic";
