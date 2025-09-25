#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/03_stripe_${TS}"; mkdir -p "$BK"
FILE="src/app/api/stripe/prices/route.ts"
[ -f "$FILE" ] && cp -a "$FILE" "$BK/" || mkdir -p "$(dirname "$FILE")"
cat > "$FILE" <<'TS'
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const ids = {
    daily:   process.env.STRIPE_PRICE_EUR_DAILY   ?? "price_fallback_daily",
    weekly:  process.env.STRIPE_PRICE_EUR_WEEKLY  ?? "price_fallback_weekly",
    monthly: process.env.STRIPE_PRICE_EUR_MONTHLY ?? "price_fallback_monthly",
    yearly:  process.env.STRIPE_PRICE_EUR_YEARLY  ?? "price_fallback_yearly",
  };
  const plans = [
    { id: ids.daily,   nickname: "Daily",   interval: "day",   unit_amount: 100,  amount: 100,  currency: "eur" },
    { id: ids.weekly,  nickname: "Weekly",  interval: "week",  unit_amount: 300,  amount: 300,  currency: "eur" },
    { id: ids.monthly, nickname: "Monthly", interval: "month", unit_amount: 900,  amount: 900,  currency: "eur" },
    { id: ids.yearly,  nickname: "Yearly",  interval: "year",  unit_amount: 9900, amount: 9900, currency: "eur" },
  ];
  return NextResponse.json({ plans }, { headers: { "Cache-Control": "no-store" } });
}
TS
grep -q "unit_amount" "$FILE" || { echo "STRIPE_ROUTE_WRITE_FAILED=1"; exit 2; }
echo "-- Acceptance --"; echo "STRIPE_ROUTE_PATCHED=1"; echo "BACKUP_DIR=$BK"
