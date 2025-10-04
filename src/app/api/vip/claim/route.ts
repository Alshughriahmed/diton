export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto";

function b64u(b: Buffer){return b.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function sign(email: string, exp: number){
  const body = b64u(Buffer.from(JSON.stringify({email,exp})));
  const sig = b64u(crypto.createHmac("sha256", process.env.VIP_SIGNING_SECRET || "").update(body).digest());
  return `${body}.${sig}`;
}
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions as any);
  const userEmail = ((session as any)?.user?.email || "").toLowerCase();
  if (!userEmail) return withReqId(NextResponse.json({ error: "auth required" }, { status: 401 }));

  const id = new URL(req.url).searchParams.get("session_id");
  if (!id) return withReqId(NextResponse.json({ error: "missing session_id" }, { status: 400 }));

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
  const cs = await stripe.checkout.sessions.retrieve(id);
  const email = (cs.customer_details?.email || cs.customer_email || "").toLowerCase();
  if (!email || email !== userEmail) return withReqId(NextResponse.json({ error: "email mismatch" }, { status: 403 }));

  const exp = typeof cs.expires_at === "number" ? cs.expires_at : Math.floor(Date.now()/1000) + 30*24*3600;
  const value = sign(email, exp);

  const res = NextResponse.redirect(new URL("/chat", req.url));
  const isProd = process.env.NODE_ENV === "production";
  
  res.cookies.set({
    name: "vip",
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    // لا تضع domain في المعاينة/المحلي حتى لا تفشل الكوكيز
    ...(isProd ? { domain: ".ditonachat.com" } : {}),
    maxAge: Math.max(0, exp - Math.floor(Date.now()/1000)),
  });

  return res;
}
export const dynamic="force-dynamic";
