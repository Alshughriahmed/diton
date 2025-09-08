import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no sig" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = (session.customer_details?.email || session.customer_email || "").toLowerCase();
    if (email) {
      // TODO: اربط DB/Redis. مؤقتًا: نادِ داخليًا نقطة VIP لديك إن كانت موجودة.
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/user/vip/dev/grant`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
      } catch {}
    }
  }
  return NextResponse.json({ ok: true });
}

async function processStripeEvent(event: any) {
  console.log("[STRIPE_EVENT]", event.type, event.id);
  
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
        
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      default:
        console.log(`[STRIPE] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("[STRIPE_EVENT_ERROR]", error);
  }
}

async function handleCheckoutCompleted(session: any) {
  console.log("[STRIPE] Checkout completed", session.id);
  
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email;
  
  // TODO: In production, update database with VIP status
  // For now, log the VIP grant
  console.log("[VIP_GRANTED]", { customerId, customerEmail, sessionId: session.id });
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log("[STRIPE] Subscription updated", subscription.id, subscription.status);
  
  const isActive = subscription.status === "active";
  const customerId = subscription.customer;
  
  // TODO: Update database with subscription status
  console.log("[VIP_STATUS_UPDATED]", { customerId, active: isActive, status: subscription.status });
}

async function handleSubscriptionDeleted(subscription: any) {
  console.log("[STRIPE] Subscription deleted", subscription.id);
  
  const customerId = subscription.customer;
  
  // TODO: Remove VIP status from database
  console.log("[VIP_REVOKED]", { customerId, subscriptionId: subscription.id });
}