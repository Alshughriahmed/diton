import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { checkRateLimit, getRateLimitKey } from "@/utils/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "_ops", "runtime", "stripe_events.json");

async function loadSet(): Promise<Set<string>> {
  try {
    const buf = await fs.readFile(FILE, "utf8");
    const arr = JSON.parse(buf) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

async function saveSet(set: Set<string>) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const arr = Array.from(set);
  await fs.writeFile(FILE, JSON.stringify(arr, null, 2));
}

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitKey = getRateLimitKey(req, 'stripe-webhook');
  if (!checkRateLimit(rateLimitKey, 30, 30)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  
  let body: any;
  try { 
    body = await req.json(); 
  } catch { 
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); 
  }
  
  const id = body?.id;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }
  
  // Deduplication check
  const set = await loadSet();
  const duplicate = set.has(id);
  if (!duplicate) { 
    set.add(id); 
    await saveSet(set); 
    
    // Process P0 events
    await processStripeEvent(body);
  }
  
  return NextResponse.json({ ok: true, duplicate }, { status: 200 });
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