import { FALLBACK_PLANS } from '@/lib/plans';
import Stripe from 'stripe';
import { NextResponse } from 'next/server';

export const runtime = "nodejs";

export async function GET() {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    const ids = [
      process.env.STRIPE_PRICE_EUR_DAILY,
      process.env.STRIPE_PRICE_EUR_WEEKLY,
      process.env.STRIPE_PRICE_EUR_MONTHLY,
      process.env.STRIPE_PRICE_EUR_YEARLY,
    ].filter(Boolean) as string[];

    if (!key || ids.length !== 4) {
      return NextResponse.json({ plans: FALLBACK_PLANS }, { status: 200 });
    }

    const stripe = new Stripe(key);
    const prices = await Promise.all(ids.map(id => stripe.prices.retrieve(id)));
    const plans = prices.map(p => ({
      id: p.id,
      priceId: p.id,
      nickname: p.nickname ?? (p.recurring?.interval ?? 'plan'),
      interval: p.recurring?.interval ?? 'month',
      amount: p.unit_amount ?? 0,
      currency: p.currency ?? 'eur',
    }));

    // ترتيب: day, week, month, year
    const order = { day: 0, week: 1, month: 2, year: 3 } as any;
    plans.sort((a,b) => (order[a.interval] ?? 9) - (order[b.interval] ?? 9));

    return NextResponse.json({ plans }, { status: 200 });
  } catch {
    return NextResponse.json({ plans: FALLBACK_PLANS }, { status: 200 });
  }
}