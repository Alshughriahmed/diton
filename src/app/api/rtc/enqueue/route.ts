import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { R, rjson, hNoStore, anonFrom, stabilizeAnonCookieToHeader, logRTC } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

export async function POST(req: NextRequest) {
  await cookies();

  // ثبّت الكوكي على قيمة الـHeader إن وُجد اختلاف
  // ثبّت الكوكي على قيمة الـHeader إن وُجد اختلاف
  await stabilizeAnonCookieToHeader(req, req.headers);
  const anon = await anonFrom(req);
  if (!anon) return rjson(req, { error: "anon-required" }, 403);

  let b: any = {};
  try { b = await req.json(); } catch {}
  const gender = String(b.gender ?? "u").toLowerCase();
  const country = String(b.country ?? req.headers.get("x-vercel-ip-country") ?? "XX").toUpperCase();
  const filterGenders = String(b.filterGenders ?? "all").toLowerCase();
  const filterCountries = String(b.filterCountries ?? "ALL").toUpperCase();

  // اكتب attrs/filters مع TTL، وأدرج في الطوابير
  const now = Date.now();
  await R.set(`rtc:attrs:${anon}`, JSON.stringify({ gender, country }));
  await R.expire(`rtc:attrs:${anon}`, 150);
  await R.set(`rtc:filters:${anon}`, JSON.stringify({ genders: filterGenders, countries: filterCountries }));
  await R.expire(`rtc:filters:${anon}`, 150);
  await R.zadd("rtc:q", now, anon);
  await R.zadd(`rtc:q:gender:${gender}`, now, anon);
  await R.zadd(`rtc:q:country:${country}`, now, anon);
  // ختم آخر Enqueue لاستخدامه كمؤشّر transient في /matchmake
  await R.set(`rtc:last:${anon}`, String(now));
  await R.expire(`rtc:last:${anon}`, 300);

  logRTC({ route: "/api/rtc/enqueue", status: 200, anonId: anon, phase: "write-attrs+q" });
  return rjson(req, { ok: true }, 200);
}


