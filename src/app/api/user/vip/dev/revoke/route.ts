export const revalidate = 0;
const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }
export const dynamic = 'force-dynamic';

export async function POST() {
  const res = __noStore(NextResponse.json({ ok: true, isVip: false }, { status: 200 }));
  res.cookies.set("vip", "", { path: "/", maxAge: 0, sameSite: "lax", httpOnly: false });
  return __noStore(res);
}
export const runtime = "nodejs";
