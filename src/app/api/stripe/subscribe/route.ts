import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2022-11-15",
});

export async function POST(req: NextRequest) {
  try {
    const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/api/vip/claim?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/plans`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "stripe_error" }, { status: 500 });
  }
}