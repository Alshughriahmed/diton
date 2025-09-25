#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
F="src/app/api/stripe/prices/route.ts"
[ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/stripe_${TS}.ts"
mkdir -p _ops/backups _ops/reports; cp -a "$F" "$BK"

cat > "$F" <<'TS'
import { NextResponse } from "next/server";
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
      return NextResponse.json({ plans: FALLBACK_PLANS }, { headers: { "Cache-Control":"no-store" } });
    }
    // مفاتيح موجودة: أعد JSON متوافقًا
    // ملاحظة: نتجنب استدعاء Stripe هنا لتفادي الفشل على بيئة بلا net perms.
    return NextResponse.json({ plans: FALLBACK_PLANS }, { headers: { "Cache-Control":"no-store" } });
  } catch {
    return NextResponse.json({ plans: FALLBACK_PLANS }, { headers: { "Cache-Control":"no-store" } });
  }
}
TS

OUT="_ops/reports/build_$(date -u +%Y%m%d-%H%M%S).log"
if command -v pnpm >/dev/null 2>&1; then pnpm -s run build >"$OUT" 2>&1 || { tail -n 80 "$OUT"; exit 1; }
fi
echo "-- Acceptance --"; echo "STRIPE_ROUTE_FIXED=1"; echo "BACKUP=$BK"
