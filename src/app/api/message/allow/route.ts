const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
import { NextResponse } from "next/server";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const H = { "cache-control":"no-store, no-cache, must-revalidate", "referrer-policy":"no-referrer" } as const;
const ffa = () => process.env.FREE_FOR_ALL==="1" || process.env.NEXT_PUBLIC_FREE_FOR_ALL==="1";
export async function GET() {
  if (ffa()) return __noStore(NextResponse.json({ ok: true, mode:"fast-path", ffa: true }, { headers: H }));
  return __noStore(NextResponse.json({ ok: false, reason:"ffa-off" }, { status: 403, headers: H }));
}
export async function POST() { return GET(); }
export async function OPTIONS() {
  return __noStore(NextResponse.json({ ok: true }, { headers: { ...H, "access-control-allow-methods": "GET,POST,OPTIONS" } }));
}
