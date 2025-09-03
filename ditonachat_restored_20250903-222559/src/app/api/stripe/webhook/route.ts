export const dynamic = 'force-dynamic';

// Webhook handler behind feature flag
const WEBHOOK_ENABLED = process.env.STRIPE_WEBHOOK_ENABLED === 'true';

// In-memory idempotency store (replace with DB in production)
const processedEvents = new Map<string, { timestamp: number; result: any }>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(req: Request) {
  if (!WEBHOOK_ENABLED) {
    return Response.json({ 
      ok: false, 
      error: 'Webhook disabled',
      flag: 'STRIPE_WEBHOOK_ENABLED=false' 
    }, { status: 501 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');
    
    // TODO: Replace with real Stripe webhook verification
    if (!signature) {
      return Response.json({ ok: false, error: 'Missing signature' }, { status: 400 });
    }

    // Parse event (stubbed)
    const event = JSON.parse(rawBody);
    const eventId = event.id;

    // Idempotency check
    const existing = processedEvents.get(eventId);
    if (existing) {
      const isExpired = Date.now() - existing.timestamp > IDEMPOTENCY_TTL;
      if (!isExpired) {
        return Response.json(existing.result);
      }
      processedEvents.delete(eventId);
    }

    // Process event based on type
    let result;
    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(event);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        result = await handleSubscriptionChange(event);
        break;
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        result = await handlePaymentUpdate(event);
        break;
      default:
        result = { ok: true, processed: false, type: event.type };
    }

    // Store result for idempotency
    processedEvents.set(eventId, {
      timestamp: Date.now(),
      result
    });

    // Cleanup expired entries periodically
    cleanupExpiredEvents();

    return Response.json(result);

  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ 
      ok: false, 
      error: 'Processing failed' 
    }, { status: 500 });
  }
}

async function handleCheckoutCompleted(event: any) {
  // TODO: Connect to DB and update user subscription
  // Example DB operations:
  // 1. Find user by customer_id or email
  // 2. Update subscription status to 'active'
  // 3. Set VIP privileges
  // 4. Send confirmation email
  
  console.log('Checkout completed:', event.data.object.id);
  return { 
    ok: true, 
    processed: true, 
    type: 'checkout.session.completed',
    todo: 'Connect to DB and activate user subscription'
  };
}

async function handleSubscriptionChange(event: any) {
  // TODO: Connect to DB and update subscription
  // Example operations:
  // 1. Update subscription status
  // 2. Adjust user privileges
  // 3. Handle proration/billing changes
  
  console.log('Subscription change:', event.type, event.data.object.id);
  return { 
    ok: true, 
    processed: true, 
    type: event.type,
    todo: 'Connect to DB and update subscription status'
  };
}

async function handlePaymentUpdate(event: any) {
  // TODO: Connect to DB and handle payment events
  // Example operations:
  // 1. Update payment status
  // 2. Handle failed payments (grace period, retries)
  // 3. Send payment notifications
  
  console.log('Payment update:', event.type, event.data.object.id);
  return { 
    ok: true, 
    processed: true, 
    type: event.type,
    todo: 'Connect to DB and handle payment status'
  };
}

function cleanupExpiredEvents() {
  const now = Date.now();
  for (const [eventId, data] of processedEvents.entries()) {
    if (now - data.timestamp > IDEMPOTENCY_TTL) {
      processedEvents.delete(eventId);
    }
  }
}