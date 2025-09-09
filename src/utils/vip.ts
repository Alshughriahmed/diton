import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function requireVip(): Promise<boolean> {
  if (process.env.FREE_FOR_ALL === "1") return true;
  // 1) كوكي HttpOnly vip=1 (الأسرع)
  try {
    const c = await cookies();
    if (c.get("vip")?.value === "1") return true;
  } catch {}
  // 2) JWT/Session
  const session = await getServerSession(authOptions as any);
  return Boolean((session as any)?.vip || (session as any)?.isVip);
}