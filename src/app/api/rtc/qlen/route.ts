// Route: /api/rtc/qlen
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"]; // بلا as const

import { cookies } from "next/headers";

const H_NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };

function hWithReqId(req: Request, extra?: Record<string, string>) {
  const rid = req.headers.get("x-req-id") || "";
  return new Headers({ ...H_NO_STORE, ...(extra || {}), ...(rid ? { "x-req-id": rid } : {}) });
}

// Upstash REST (ENV فقط)
async function upstash(cmd: (string | number)[] | (string | number)[][]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("UPSTASH env missing");
  const isPipe = Array.isArray(cmd[0]);
  const res = await fetch(`${url}${isPipe ? "/pipeline" : ""}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(isPipe ? cmd : cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json();
}

function log(req: Request, data: Record<string, unknown>) {
  const rid = req.headers.get("x-req-id") || "";
  console.log(JSON.stringify({ reqId: rid, role: "server", ...data }));
}

export async function OPTIONS(req: Request) {
  await cookies();
  return new Response(null, { status: 204, headers: hWithReqId(req) });
}

// GET: ينظف الأشباح ويعيد إحصاءات qlen
export async function GET(req: Request) {
  const t0 = Date.now();
  await cookies();
  const headers = hWithReqId(req, { "Content-Type": "application/json; charset=utf-8" });

  // anti-ghost: إزالة عناصر أقدم من 60s من ZSET rtc:q
  const now = Date.now();
  const cutoff = now - 60_000;

  // 1) تنظيف الأشباح + إجمالي qlen
  // 2) byGender: لكل مفتاح rtc:q:gender:* → ZCARD
  // 3) byRegion: لكل مفتاح rtc:q:country:* → ZCARD
  // 4) byVip: محاولة ZINTERCARD بين rtc:q و rtc:vip (يتطلب كلاهما ZSET). إن فشل، نعطي null.
  try {
    // تنظيف
    const [cleanedRes, totalRes] = await upstash([
      ["ZREMRANGEBYSCORE", "rtc:q", "-inf", `(${cutoff}`],
      ["ZCARD", "rtc:q"],
    ]);

    const ghosts_cleaned = Number(cleanedRes?.result ?? 0);
    const total = Number(totalRes?.result ?? 0);

    // جمع مفاتيح الجنس والمناطق
    const [gKeysRes, rKeysRes] = await Promise.all([
      upstash(["KEYS", "rtc:q:gender:*"]),
      upstash(["KEYS", "rtc:q:country:*"]),
    ]);

    const gKeys: string[] = (gKeysRes?.result as string[]) || [];
    const rKeys: string[] = (rKeysRes?.result as string[]) || [];

    // حساب ZCARD لكل مفتاح
    const gP: (string | number)[][] = gKeys.map((k) => ["ZCARD", k]);
    const rP: (string | number)[][] = rKeys.map((k) => ["ZCARD", k]);
    const [gCards, rCards] = await Promise.all([
      gP.length ? upstash(gP) : Promise.resolve([]),
      rP.length ? upstash(rP) : Promise.resolve([]),
    ]);

    const byGender: Record<string, number> = {};
    const byRegion: Record<string, number> = {};

    gKeys.forEach((k, i) => {
      const g = k.split(":").pop() || k;
      const n = Number((gCards?.[i]?.result ?? 0) as number);
      byGender[g] = n;
    });

    rKeys.forEach((k, i) => {
      const cc = k.split(":").pop() || k;
      const n = Number((rCards?.[i]?.result ?? 0) as number);
      byRegion[cc] = n;
    });

    // byVip: تفضيل ZINTERCARD (يتطلب rtc:vip كـ ZSET). خلاف ذلك نُرجع null.
    let byVip: number | null = null;
    try {
      const zInt = await upstash(["ZINTERCARD", 2, "rtc:q", "rtc:vip"]);
      byVip = Number(zInt?.result ?? 0);
    } catch {
      byVip = null;
    }

    const body = {
      ok: true,
      total,
      byGender,
      byRegion,
      byVip,
      ghosts_cleaned,
      ts: now,
    };

    log(req, {
      op: "qlen",
      phase: "done",
      outcome: "200",
      latencyMs: Date.now() - t0,
      total,
      ghosts_cleaned,
    });

    return new Response(JSON.stringify(body), { status: 200, headers });
  } catch (e) {
    log(req, { op: "qlen", phase: "error", outcome: "500", msg: String(e), latencyMs: Date.now() - t0 });
    return new Response(JSON.stringify({ ok: false, error: "server" }), { status: 500, headers });
  }
}
