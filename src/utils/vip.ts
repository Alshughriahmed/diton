import { cookies } from "next/headers";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function requireVip(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_FREE_FOR_ALL === "1") return true;
  try {
    const c = (await cookies()).get("vip")?.value;
    if (verifySignedVip(c)) return true;     // signed cookie
    if (c === "1") return true;              // legacy fallback
  } catch {}
  const session:any = await getServerSession(authOptions as any);
  const exp = session?.vipExp as number | undefined;
  if (session?.vip && typeof exp === "number" && exp > Math.floor(Date.now()/1000)) return true;
  return Boolean(session?.isVip);
}
const VIP_SECRET = process.env.VIP_SIGNING_SECRET || "";
type VipPayload = { email: string; exp: number };
const b64u = (b: Buffer) => b.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
function verifySignedVip(v?: string): VipPayload | null {
  if (!v || !VIP_SECRET) return null;
  const [body, sig] = v.split(".");
  if (!body || !sig) return null;
  const expect = b64u(crypto.createHmac("sha256", VIP_SECRET).update(body).digest());
  if (sig !== expect) return null;
  try {
    const p = JSON.parse(Buffer.from(body.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString()) as VipPayload;
    if (!p.email || !p.exp || Math.floor(Date.now()/1000) >= p.exp) return null;
    return p;
  } catch { return null; }
}
