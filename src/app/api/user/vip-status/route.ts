const __withNoStore = <T extends Response>(r:T):T => { try { (r as any).headers?.set?.("cache-control","no-store"); } catch {} return r; };
export const revalidate = 0;
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function __noStore(res: any){ try{ res.headers?.set?.("Cache-Control","no-store"); }catch{} return res; }
export const dynamic = 'force-dynamic';

export async function GET() {
  const c = await cookies();
  const cookieVip = c.get("vip")?.value === "1";
  const session = await getServerSession(authOptions as any);
  const sessionVip = Boolean((session as any)?.vip || (session as any)?.isVip);
  const vipExp = Number((session as any)?.vipExp || 0);
  return __noStore(Response.json({ cookieVip, sessionVip, vipExp }));;
}
export const runtime="nodejs";
