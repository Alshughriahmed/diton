#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/02_env_${TS}"; mkdir -p "$BK"
FILE="src/app/api/rtc/env/route.ts"; mkdir -p "$(dirname "$FILE")"
[ -f "$FILE" ] && cp -a "$FILE" "$BK/"

cat > "$FILE" <<'TS'
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const server = { FREE_FOR_ALL: process.env.FREE_FOR_ALL ?? "0" };
  const pub = { NEXT_PUBLIC_FREE_FOR_ALL: process.env.NEXT_PUBLIC_FREE_FOR_ALL ?? "0" };
  return NextResponse.json({ server, public: pub }, { headers: { "Cache-Control": "no-store" } });
}
TS
grep -q "return NextResponse.json({ server, public: pub }" "$FILE" || { echo "ENV_ROUTE_WRITE_FAILED=1"; exit 2; }
echo "-- Acceptance --"; echo "API_ENV_ROUTE_OK=1"; echo "BACKUP_DIR=$BK"
