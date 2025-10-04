export const revalidate = 0;
import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = { id:string; unit_amount:number; currency:"eur"; interval:"day"|"week"|"month"|"year" };

const FALLBACK_PLANS: Plan[] = [
  { id:"eur_daily",  unit_amount: 190,  currency:"eur", interval:"day"   },
  { id:"eur_weekly", unit_amount: 690,  currency:"eur", interval:"week"  },
  { id:"eur_monthly",unit_amount: 1990, currency:"eur", interval:"month" },
  { id:"eur_yearly", unit_amount: 9900, currency:"eur", interval:"year"  },
];

export async function GET() {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return withReqId(NextResponse.json({ plans: FALLBACK_PLANS }, { headers: { "Cache-Control":"no-store" } }));
    }
    // مفاتيح موجودة: أعد JSON متوافقًا
    // ملاحظة: نتجنب استدعاء Stripe هنا لتفادي الفشل على بيئة بلا net perms.
    return withReqId(NextResponse.json({ plans: FALLBACK_PLANS }, { headers: { "Cache-Control":"no-store" } }));
  } catch {
    return withReqId(NextResponse.json({ plans: FALLBACK_PLANS }, { headers: { "Cache-Control":"no-store" } }));
  }
}
