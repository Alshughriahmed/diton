export const dynamic = 'force-dynamic';
export async function GET() {
  const PRICES = [
    { id: process.env.STRIPE_PRICE_ID_EUR_149 ?? 'eur_149',  unit_amount: 149,  currency: 'EUR', label: 'Starter' },
    { id: process.env.STRIPE_PRICE_ID_EUR_599 ?? 'eur_599',  unit_amount: 599,  currency: 'EUR', label: 'Plus'    },
    { id: process.env.STRIPE_PRICE_ID_EUR_1699?? 'eur_1699', unit_amount: 1699, currency: 'EUR', label: 'Pro'     },
    { id: process.env.STRIPE_PRICE_ID_EUR_9999?? 'eur_9999', unit_amount: 9999, currency: 'EUR', label: 'Ultra'   },
  ];
  return Response.json({ ok:true, mode:'fallback', prices: PRICES }, { headers: { 'Cache-Control': 'no-store' }});
}
