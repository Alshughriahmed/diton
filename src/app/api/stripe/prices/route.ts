import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function normalize(p: Stripe.Price) {
  return {
    id: p.id,
    amount: typeof p.unit_amount === "number" ? p.unit_amount : 0,
    currency: (p.currency || "usd").toLowerCase(),
    interval: (p.recurring?.interval || "month")
  };
}

export async function GET() {
  const ids = [
    process.env.STRIPE_BOOST_ME_DAILY_ID,
    process.env.STRIPE_PRO_WEEKLY_ID,
    process.env.STRIPE_VIP_MONTHLY_ID,
    process.env.STRIPE_ELITE_YEARLY_ID,
  ].filter(Boolean) as string[];

  // ENV specific mode only
  if (ids.length === 4 && process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const prices: any[] = [];
    for (const id of ids) {
      try { prices.push(normalize(await stripe.prices.retrieve(id))); } catch { /* skip */ }
    }
    if (prices.length === 4) return NextResponse.json({ prices });
  }

  // Fallback old: basic only
  return NextResponse.json({ prices: [{ id: "basic", amount: 999, currency: "usd", interval: "month" }] });
}