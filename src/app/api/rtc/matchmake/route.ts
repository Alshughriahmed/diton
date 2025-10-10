import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  R,
  rjson,
  rempty,
  hNoStore,
  anonFrom,
  stabilizeAnonCookieToHeader,
  kAttrs,
  kFilters,
  kPairMap,
  kClaim,
  kLast,
  logRTC,
} from "../_lib";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

type MMOut = { status: 200 | 204 | 400; body?: any };

// ===== fast-path: استخدم الخريطة إن وُجدت وتحققت =====
async function fastPath(anon: string) {
  const map = await R.get(kPairMap(anon));
  if (!map) return null;
  const [pairId, role] = String(map).split("|");
  if (!pairId || !role) {
    await R.del(kPairMap(anon));
    return null;
  }
  const exists = await R.exists(`rtc:pair:${pairId}`);
  if (!exists) {
    await R.del(kPairMap(anon));
    return null;
  }
  // تكامل سريع: استرجاع الطرف الآخر عند الإمكان
  const p = await R.hgetall(`rtc:pair:${pairId}`).catch(() => null as any);
  const a = p?.a ?? p?.callerAnon;
  const b = p?.b ?? p?.calleeAnon;
  const peerAnonId = a === anon ? b : a;
  return { pairId, role, peerAnonId };
}

// ===== إنشاء زوج آمن مع claim ذرّي للطرف الآخر =====
async function createPair(anon: string, cand: string) {
  const lockOther = await R.setNxPx(kClaim(cand), anon, 5000);
  if (!lockOther) return null;

  // قفل جزئي للطرف الحالي أيضًا لدرء السباقات المتزامنة
  const lockSelf = await R.setNxPx(kClaim(anon), cand, 5000);
  if (!lockSelf) {
    await R.del(kClaim(cand));
    return null;
  }

  // attrs للتحجيم وتنظيف الصفوف المشتقة
  const rawA = await R.get(kAttrs(anon));
  const rawB = await R.get(kAttrs(cand));
  let aAttr: any = null,
    bAttr: any = null;
  try {
    aAttr = rawA ? JSON.parse(rawA) : null;
  } catch {}
  try {
    bAttr = rawB ? JSON.parse(rawB) : null;
  } catch {}
  if (!aAttr || !bAttr) {
    await R.del(kClaim(cand));
    await R.del(kClaim(anon));
    return null;
  }

  // نظّف من الطوابير
  await R.zrem("rtc:q", anon);
  await R.zrem("rtc:q", cand);
  await R.zrem(`rtc:q:gender:${aAttr.gender}`, anon);
  await R.zrem(`rtc:q:gender:${bAttr.gender}`, cand);
  await R.zrem(`rtc:q:country:${aAttr.country || "XX"}`, anon);
  await R.zrem(`rtc:q:country:${bAttr.country || "XX"}`, cand);

  // اكتب الزوج والخرائط + TTL
  const pairId = randomBytes(12).toString("hex");
  const now = Date.now();
  await R.hset(`rtc:pair:${pairId}`, {
    a: anon,
    b: cand,
    ts: now,
    role_a: "caller",
    role_b: "callee",
  });
  await R.expire(`rtc:pair:${pairId}`, 150);

  await R.set(kPairMap(anon), `${pairId}|caller`);
  await R.expire(kPairMap(anon), 150);
  await R.set(kPairMap(cand), `${pairId}|callee`);
  await R.expire(kPairMap(cand), 150);

  return { pairId, role: "caller" as const, peerAnonId: cand };
}

async function handleMM(req: NextRequest): Promise<MMOut> {
  await cookies();

  // ثبّت الكوكي على قيمة Header إن وُجد اختلاف
  await stabilizeAnonCookieToHeader(req);
  const anon = await anonFrom(req);
  const rid = req.headers.get("x-req-id") || "";
  if (!anon) return { status: 400, body: { error: "anon-required" } };

  // 1) fast‑path (خريطة سليمة + وجود الزوج)
  const fp = await fastPath(anon);
  if (fp) {
    logRTC({
      route: "/api/rtc/matchmake",
      status: 200,
      rid,
      anonId: anon,
      pairId: fp.pairId,
      role: fp.role,
      phase: "fast-path",
      mapOK: true,
      pairExists: true,
    });
    return { status: 200, body: fp };
  }

  // 2) تأكد من attrs ذاتها — رد 204 للـtransient، و400 للغياب الحقيقي
  const a = await R.get(kAttrs(anon));
  if (!a) {
    const last = Number(await R.get(kLast(anon)));
    const grace = 2500; // نافذة عابرة بعد enqueue
    if (last && Date.now() - last <= grace) {
      logRTC({ route: "/api/rtc/matchmake", status: 204, rid, anonId: anon, phase: "attrs-transient" });
      return { status: 204 };
    }
    logRTC({ route: "/api/rtc/matchmake", status: 400, rid, anonId: anon, phase: "attrs-missing" });
    return { status: 400, body: { error: "missing-attrs" } };
  }

  // 3) التماس مرشح من الصف العام (أقدم 15 عنصرًا مثلاً)
  const waiters = (await R.zrange("rtc:q", 0, 14)) as string[] | null;
  if (!waiters || waiters.length === 0 || (waiters.length === 1 && waiters[0] === anon)) {
    logRTC({ route: "/api/rtc/matchmake", status: 204, rid, anonId: anon, phase: "no-candidate" });
    return { status: 204 };
  }

  for (const cand of waiters) {
    if (!cand || cand === anon) continue;

    // تحقّق cand موجودة فعلاً (تنظيف أشباح)
    const cattr = await R.get(kAttrs(cand));
    if (!cattr) {
      await R.zrem("rtc:q", cand);
      continue;
    }

    const pair = await createPair(anon, cand);
    if (pair) {
      logRTC({
        route: "/api/rtc/matchmake",
        status: 200,
        rid,
        anonId: anon,
        pairId: pair.pairId,
        role: pair.role,
        phase: "paired",
        mapOK: true,
        pairExists: true,
      });
      return { status: 200, body: pair };
    }
  }

  // لم ننجح بالاقتران في هذه الدورة
  logRTC({ route: "/api/rtc/matchmake", status: 204, rid, anonId: anon, phase: "no-lock" });
  return { status: 204 };
}

async function handle(req: NextRequest) {
  const out = await handleMM(req);
  if (out.status === 204) return rempty(req, 204);
  return rjson(req, out.body || {}, out.status);
}

export const GET = handle;
export const POST = handle;
