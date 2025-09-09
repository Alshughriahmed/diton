import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("missing STRIPE_WEBHOOK_SECRET", { status: 500 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
  const sig = req.headers.get("stripe-signature") || "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    // TODO: مزامنة الاستحقاق مع مخزن دائم لاحقًا (اختياري للـMVP)
  }

  return NextResponse.json({ ok: true });
}
