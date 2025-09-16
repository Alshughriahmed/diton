export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";

const NO_STORE = {
  "cache-control": "no-store, no-cache, must-revalidate",
  "referrer-policy": "no-referrer",
  "content-type": "application/json"
};

function j(b: any, s?: number | { status?: number }): NextResponse {
  return NextResponse.json(b, {
    status: (typeof s === "number" ? s : (s?.status || 200)),
    headers: NO_STORE
  });
}

function resolvePriceId(inputId: string, plan: string, env: any) {
  if (inputId && /^price_/.test(inputId)) return inputId;
  const mp: Record<string, string> = {
    day: String(env.STRIPE_PRICE_ID_EUR_149 || env.STRIPE_PRICE_EUR_DAILY || ""),
    daily: String(env.STRIPE_PRICE_ID_EUR_149 || env.STRIPE_PRICE_EUR_DAILY || ""),
    week: String(env.STRIPE_PRICE_ID_EUR_599 || env.STRIPE_PRICE_EUR_WEEKLY || ""),
    weekly: String(env.STRIPE_PRICE_ID_EUR_599 || env.STRIPE_PRICE_EUR_WEEKLY || ""),
    month: String(env.STRIPE_PRICE_ID_EUR_1699 || env.STRIPE_PRICE_EUR_MONTHLY || ""),
    monthly: String(env.STRIPE_PRICE_ID_EUR_1699 || env.STRIPE_PRICE_EUR_MONTHLY || ""),
    year: String(env.STRIPE_PRICE_ID_EUR_9999 || env.STRIPE_PRICE_EUR_YEARLY || ""),
    yearly: String(env.STRIPE_PRICE_ID_EUR_9999 || env.STRIPE_PRICE_EUR_YEARLY || "")
  };
  return mp[plan] || "";
}

export async function POST(req: NextRequest) {
  try {
    // Dual session guard: cookie check + session validation
    const ck = req.headers.get("cookie") || "";
    const hasAuthCookie = ck.includes("next-auth.session-token") || ck.includes("__Secure-next-auth.session-token");
    if (!hasAuthCookie) { return j({ error: "unauthorized" }, 401); }
    
    const session = await getServerSession();
    if (!session?.user) { return j({ error: "unauthorized" }, 401); }

    // Check for Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      return j({ error: "stripe not configured" }, 500);
    }

    // Enhanced parsing for priceId and plan
    let priceId = "";
    let plan = "";
    
    try {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body: any = await req.json();
        priceId = (body?.priceId || "").trim();
        plan = (body?.plan || "").trim();
      } else {
        const txt = await req.text();
        try { 
          const body: any = JSON.parse(txt || "{}"); 
          priceId = (body?.priceId || "").trim(); 
          plan = (body?.plan || "").trim(); 
        } catch {
          // Fallback to URL params
          const url = new URL(req.url);
          priceId = url.searchParams.get("priceId") || "";
          plan = url.searchParams.get("plan") || "";
        }
      }
    } catch {
      // Final fallback to URL params
      const url = new URL(req.url);
      priceId = url.searchParams.get("priceId") || "";
      plan = url.searchParams.get("plan") || "";
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Resolve final priceId
    priceId = resolvePriceId(priceId, plan, process.env);
    if (!priceId) {
      return j({ error: "invalid priceId or plan" }, 400);
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || (new URL(req.url)).origin || "https://www.ditonachat.com";
    
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/api/vip/claim?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/plans`,
    });

    return j({ url: stripeSession.url }, 200);
  } catch (e: any) {
    return j({ error: e?.message || "stripe_error" }, 500);
  }
}