import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  try {
    const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
    
    // Check for Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "stripe not configured" }, { status: 500 });
    }
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const PRICES: Record<string, string | undefined> = {
      daily: process.env.STRIPE_PRICE_EUR_DAILY,
      weekly: process.env.STRIPE_PRICE_EUR_WEEKLY,
      monthly: process.env.STRIPE_PRICE_EUR_MONTHLY,
      yearly: process.env.STRIPE_PRICE_EUR_YEARLY,
    };
    const priceId = plan ? PRICES[plan] : undefined;
    if (!priceId) {
      return NextResponse.json({ error: "invalid plan" }, { status: 400 });
    }

    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;

    const base = process.env.NEXT_PUBLIC_BASE_URL || (new URL(req.url)).origin || "https://www.ditonachat.com";
const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/api/vip/claim?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/plans`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "stripe_error" }, { status: 500 });
  }
}