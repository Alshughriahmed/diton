const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;






import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }

export async function GET() {
  const server = { FREE_FOR_ALL: process.env.FREE_FOR_ALL ?? "0" };
  const pub = { NEXT_PUBLIC_FREE_FOR_ALL: process.env.NEXT_PUBLIC_FREE_FOR_ALL ?? "0" };
  return withReqId(__noStore(NextResponse.json({ server, public: pub }, { headers: { "Cache-Control": "no-store" } })));;
}
