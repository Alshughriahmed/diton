import { cookies } from "next/headers";
import { getServerSession } from "next-auth";


export async function GET() {
  const c = await cookies();
  const cookieVip = c.get("vip")?.value === "1";
  const session = await getServerSession();
  const sessionVip = Boolean((session as any)?.vip || (session as any)?.isVip);
  const vipExp = Number((session as any)?.vipExp || 0);
  return Response.json({ cookieVip, sessionVip, vipExp });
}
export const runtime="nodejs";
export const dynamic="force-dynamic";
