import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  R,
  rjson,
  hNoStore,
  anonFrom,
  stabilizeAnonCookieToHeader,
  normalizeAttrs,
  normalizeFilters,
  kAttrs,
  kFilters,
  kLast,
  logRTC,
} from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

export async function POST(req: NextRequest) {
  await cookies();
  // ثبّت الكوكي على قيمة الـHeader إن وُجد اختلاف
  await stabilizeAnonCookieToHeader(req);
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403);

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  // التطبيع كما في _lib.ts
  const attrs = normalizeAttrs({ gender: body?.gender, country: body?.country });
  const filters = normalizeFilters({
    gender: body?.filterGenders,
    country: body?.filterCountries,
  });

  // اكتب attrs/filters بTTL، وأدرج في الطوابير العامة والمشتقة
  const now = Date.now();
  await R.set(kAttrs(anon), JSON.stringify({ gender: attrs.gender, country: attrs.country, ts: now }));
  await R.expire(kAttrs(anon), 150);

  await R.set(kFilters(anon), JSON.stringify({ genders: filters.gender, countries: filters.country }));
  await R.expire(kFilters(anon), 150);

  await R.zadd("rtc:q", now, anon);
  await R.zadd(`rtc:q:gender:${attrs.gender}`, now, anon);
  await R.zadd(`rtc:q:country:${attrs.country || "XX"}`, now, anon);

  // ختم آخر enqueue لاستخدامه كنافذة transient في /matchmake
  await R.set(kLast(anon), String(now));
  await R.expire(kLast(anon), 300);

  logRTC({ route: "/api/rtc/enqueue", status: 200, anonId: anon, phase: "write-attrs+q" });
  return rjson(req, { ok: true }, 200);
}
