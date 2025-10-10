// Upstash REST + anon helpers + uniform responses/logs (RTC only)
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, randomBytes } from "node:crypto";

/* ---------- uniform no-store + x-req-id ---------- */
export function reqId(req: Request) { return req.headers.get("x-req-id") || ""; }
export function hNoStore(req: Request, extra?: Record<string, string>) {
  const h = new Headers({ "Cache-Control": "no-store", ...(extra || {}) });
  const rid = reqId(req); if (rid) h.set("x-req-id", rid);
  return h;
}
export function rjson(req: Request, body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), { status, headers: hNoStore(req, { "content-type": "application/json" }) });
}
export function rempty(req: Request, status = 204) {
  return new NextResponse(null, { status, headers: hNoStore(req) });
}

/* ---------- Upstash Redis (REST) ---------- */
const RURL = process.env.UPSTASH_REDIS_REST_URL!;
const RTOK = process.env.UPSTASH_REDIS_REST_TOKEN!;
async function rexec(args: (string | number)[]) {
  const res = await fetch(RURL, { method: "POST", headers: { "Authorization": `Bearer ${RTOK}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || res.statusText);
  return j?.result;
}
export const R = {
  async get(k: string) { return await rexec(["GET", k]); },
  async set(k: string, v: string) { return await rexec(["SET", k, v]); },
  async del(k: string) { return await rexec(["DEL", k]); },
  async exists(k: string) { return Number(await rexec(["EXISTS", k])) || 0; },
  async expire(k: string, sec: number) { return await rexec(["EXPIRE", k, sec]); },
  async hgetall(k: string) { const arr = (await rexec(["HGETALL", k])) as any[] | null; if (!Array.isArray(arr)) return {}; const o: Record<string,string> = {}; for (let i=0;i<arr.length;i+=2) o[String(arr[i])] = String(arr[i+1]); return o; },
  async hset(k: string, fields: Record<string, any>) { const a:(string|number)[]=["HSET",k]; for (const [f,v] of Object.entries(fields)) a.push(f, typeof v==="string"?v:JSON.stringify(v)); return await rexec(a); },
  async setNxPx(k: string, v: string, ms: number) { return (await rexec(["SET", k, v, "NX", "PX", ms])) === "OK"; },
  async zcard(k: string) { return Number(await rexec(["ZCARD", k])) || 0; },
};

/* ---------- anon (Header first, then signed cookie; NEVER rotate here) ---------- */
function sign(id: string) {
  const key = process.env.ANON_SIGNING_SECRET || "";
  return createHmac("sha256", key).update(id).digest("hex");
}
export async function anonFrom(req: NextRequest): Promise<string | null> {
  await cookies();
  const hdr = (req.headers.get("x-anon-id") || "").trim();
  if (hdr) return hdr;

  const jar = cookies();
  const raw = jar.get("anon")?.value || jar.get("anonId")?.value || jar.get("ditona_anon")?.value || "";
  if (!raw) return null;
  const p = raw.split(".");
  if (p.length === 3 && p[0] === "v1" && p[2] === sign(p[1])) return p[1];
  return p.length === 3 ? p[1] : raw; // تسامح
}

/** استدعِ هذا فقط من /api/rtc/init لإنشاء الكوكي إن كان مفقودًا. */
export async function ensureAnonCookie(req: NextRequest): Promise<string> {
  await cookies();
  const cur = await anonFrom(req);
  if (cur) return cur;

  const id = randomBytes(16).toString("hex");
  const val = `v1.${id}.${sign(id)}`;
  const jar = cookies();
  // مجال الكوكي: نحترم www.* والـpreview؛ لا نُثبّت domain إلا إذا كنّا على الدومين الرئيسي.
  const host = (req.headers.get("host") || "").toLowerCase();
  const cookieInit: any = { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60*60*24*365*5 };
  if (host.endsWith("ditonachat.com")) cookieInit.domain = ".ditonachat.com";
  jar.set("anon", val, cookieInit);
  return id;
}

/* ---------- logging ---------- */
export function logRTC(fields: Record<string, any>) {
  try { console.log(JSON.stringify({ ts: new Date().toISOString(), mod: "rtc", ...fields })); } catch {}
}
