import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const c = cookies();
  const cookieVip = c.get("vip")?.value === "1";
  const session = await getServerSession(authOptions as any);
  const sessionVip = Boolean((session as any)?.vip || (session as any)?.isVip);
  const vipExp = Number((session as any)?.vipExp || 0);
  return Response.json({ cookieVip, sessionVip, vipExp });
}
