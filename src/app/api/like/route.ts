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

const kCount = (p: string) => `likes:count:${p}`;
const kWho   = (p: string) => `likes:who:${p}`;

function parseAnon(req: NextRequest) {
  const ck = cookies();
  return (
    req.headers.get("x-anon") ||
    ck.get("anon")?.value ||
    ck.get("ditona_anon")?.value ||
    ""
  );
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const pairId = sp.get("pairId");
  if (!pairId) return NextResponse.json({ error: "pairId required" }, { status: 400 });

  const anon = parseAnon(req) || "";
  const res = await redis([
    ["GET", kCount(pairId)],
    ["SISMEMBER", kWho(pairId), anon],
  ]);

  const count = Number(res?.[0]?.result ?? 0);
  const you = !!(res?.[1]?.result ?? false);
  return NextResponse.json({ count: Number.isFinite(count) ? count : 0, you });
}

export async function POST(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const pairId = sp.get("pairId");
  const op = (sp.get("op") || "inc").toLowerCase();
  if (!pairId) return NextResponse.json({ error: "pairId required" }, { status: 400 });

  const anon = parseAnon(req);
  if (!anon) return NextResponse.json({ error: "x-anon or anon cookie required" }, { status: 400 });

  if (op === "inc") {
    const add = await redis([["SADD", kWho(pairId), anon]]);
    const added = Number(add?.[0]?.result ?? 0) === 1;
    if (added) {
      const inc = await redis([["INCR", kCount(pairId)]]);
      const count = Number(inc?.[0]?.result ?? 0);
      return NextResponse.json({ ok: true, count, you: true });
    } else {
      const get = await redis([["GET", kCount(pairId)]]);
      const count = Number(get?.[0]?.result ?? 0);
      return NextResponse.json({ ok: true, count, you: true });
    }
  } else if (op === "dec") {
    const rem = await redis([["SREM", kWho(pairId), anon]]);
    const removed = Number(rem?.[0]?.result ?? 0) === 1;
    if (removed) {
      const decr = await redis([["DECR", kCount(pairId)]]);
      let count = Number(decr?.[0]?.result ?? 0);
      if (!Number.isFinite(count) || count < 0) {
        await redis([["SET", kCount(pairId), "0"]]);
        count = 0;
      }
      return NextResponse.json({ ok: true, count, you: false });
    } else {
      const get = await redis([["GET", kCount(pairId)]]);
      const count = Number(get?.[0]?.result ?? 0);
      return NextResponse.json({ ok: true, count, you: false });
    }
  }
  return NextResponse.json({ error: "op must be inc or dec" }, { status: 400 });
}
