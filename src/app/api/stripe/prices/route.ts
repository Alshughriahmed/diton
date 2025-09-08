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
    const plans: any[] = [];
    for (const id of ids) {
      try { 
        const price = await stripe.prices.retrieve(id);
        plans.push({
          id: price.id,
          nickname: price.nickname || `Plan ${plans.length + 1}`,
          unit_amount: price.unit_amount || 0,
          currency: price.currency || "usd",
          interval: price.recurring?.interval || "month"
        });
      } catch { /* skip */ }
    }
    if (plans.length === 4) return NextResponse.json({ plans });
  }

  // Fallback: 4 mock plans
  return NextResponse.json({ 
    plans: [
      { id: "boost_daily", nickname: "Boost Me Daily", unit_amount: 299, currency: "usd", interval: "day" },
      { id: "pro_weekly", nickname: "Pro Weekly", unit_amount: 999, currency: "usd", interval: "week" },
      { id: "vip_monthly", nickname: "VIP Monthly", unit_amount: 2999, currency: "usd", interval: "month" },
      { id: "elite_yearly", nickname: "Elite Yearly", unit_amount: 29999, currency: "usd", interval: "year" }
    ]
  });
}