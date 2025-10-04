import { jsonEcho } from "@/lib/api/xreq";
import { withReqId } from "@/lib/http/withReqId";
import { logRTC } from "@/lib/rtc/logger";

const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];






import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID, createHmac } from "crypto";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }



function signAnon(raw: string, secret?: string) {
  if (!secret) return raw; // يسمح بالعمل بدون توقيع لو السر غير مضبوط
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  return `${raw}.${sig}`;
}

async function setAnonCookie() {
  const jar = await cookies();
  const existing = jar.get("anon")?.value;
  const raw = existing?.split(".")[0] || randomUUID();
  const secret = process.env.ANON_SIGNING_SECRET;
  const value = signAnon(raw, secret);
  jar.set("anon", value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  return value;
}

export async function POST(req: Request) {
  const start = Date.now();
  const reqId = req.headers.get("x-req-id") || randomUUID();
  
  await setAnonCookie();
  const res = jsonEcho(req, { ok: true }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  
  logRTC({
    route: "/api/rtc/init",
    reqId,
    ms: Date.now() - start,
    status: 200,
    note: "init-ok",
  });
  
  return __noStore(res);
}

export async function GET(req: Request) {
  return POST(req);
}
