export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";

const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate",
  "referrer-policy": "no-referrer",
  "content-type": "application/json"
};

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

    // Check for Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "stripe not configured" }, { 
        status: 500, 
        headers: NO_STORE_HEADERS 
      });
    }

    // Session check - must have authenticated user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { 
        status: 401, 
        headers: NO_STORE_HEADERS 
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Resolve final priceId
    priceId = resolvePriceId(priceId, plan, process.env);
    if (!priceId) {
      return NextResponse.json({ error: "invalid priceId or plan" }, { 
        status: 400, 
        headers: NO_STORE_HEADERS 
      });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || (new URL(req.url)).origin || "https://www.ditonachat.com";
    
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/api/vip/claim?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/plans`,
    });

    return NextResponse.json({ url: stripeSession.url }, { 
      status: 200, 
      headers: NO_STORE_HEADERS 
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "stripe_error" }, { 
      status: 500, 
      headers: NO_STORE_HEADERS 
    });
  }
}