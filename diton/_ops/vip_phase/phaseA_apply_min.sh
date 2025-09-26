set -euo pipefail

# route: /api/vip/claim
cat > src/app/api/vip/claim/route.ts <<'TS'
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function b64u(b: Buffer){return b.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function sign(email: string, exp: number){
  const crypto = await import("crypto");
  const body = b64u(Buffer.from(JSON.stringify({email,exp})));
  const sig = b64u(crypto.createHmac("sha256", process.env.VIP_SIGNING_SECRET || "").update(body).digest());
  return `${body}.${sig}`;
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions as any);
  const userEmail = ((session as any)?.user?.email || "").toLowerCase();
  if (!userEmail) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("session_id");
  if (!id) return NextResponse.json({ error: "missing session_id" }, { status: 400 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
  const cs = await stripe.checkout.sessions.retrieve(id);
  const email = (cs.customer_details?.email || cs.customer_email || "").toLowerCase();
  if (!email || email !== userEmail) return NextResponse.json({ error: "email mismatch" }, { status: 403 });

  const exp = typeof cs.expires_at === "number" ? cs.expires_at : Math.floor(Date.now()/1000) + 30*24*3600;
  const value = await sign(email, exp);

  cookies().set({
    name: "vip",
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    domain: ".ditonachat.com",
    maxAge: Math.max(0, exp - Math.floor(Date.now()/1000)),
  });

  return NextResponse.redirect(new URL("/chat", req.url));
}
TS

# patch success_url/cancel_url in subscribe route
sub="src/app/api/stripe/subscribe/route.ts"
if [ -f "$sub" ]; then
  base='${process.env.NEXTAUTH_URL||`https://${req.headers.get("host")}`}'
  perl -0777 -pe 's/success_url:\s*["\'][^"\']+["\']/success_url: `'"$base"'/api\/vip\/claim?session_id=\{CHECKOUT_SESSION_ID\}`/' -i "$sub" || true
  perl -0777 -pe 's/cancel_url:\s*["\'][^"\']+["\']/cancel_url: `'"$base"'\/plans`/' -i "$sub" || true
fi

echo "-- Changes --"
git ls-files -m -o --exclude-standard | sed 's/^/CHANGED: /'
echo "-- End Changes --"
