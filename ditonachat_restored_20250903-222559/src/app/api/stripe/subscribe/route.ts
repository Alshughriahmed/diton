export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const body = await req.json().catch(()=>({}));
  const priceId = body?.priceId ?? 'unknown';
  // Placeholder URL for acceptance; real integration uses Stripe SDK.
  const url = `https://checkout.example.test/stripe_checkout?price=${encodeURIComponent(priceId)}`;
  return Response.json({ ok:true, checkoutUrl: url }, { headers: { 'Cache-Control': 'no-store' }});
}
