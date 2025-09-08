import { getServerSession } from "next-auth";
import { authOptions } from "../app/api/auth/[...nextauth]/route";

// helper: Check if user has VIP access
export async function requireVip() {
  if (process.env.FREE_FOR_ALL === "1") return true;
  const session = await getServerSession(authOptions as any);
  return !!(session as any)?.isVip;
}