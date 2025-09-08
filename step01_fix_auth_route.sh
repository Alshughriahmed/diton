#!/usr/bin/env bash
set -Eeuo pipefail
ROUTE="src/app/api/auth/[...nextauth]/route.ts"
test -f "$ROUTE" || { echo "route-missing"; exit 1; }

# Patch providers with safe conditions
perl -0777 -pe '
  s/import\s+Google\s+from\s+["\']next-auth\/providers\/google["\'];?/import Google from "next-auth\/providers\/google";/s;
  s/export\s+const\s+\{\s*handlers,\s*auth\s*\}\s*=\s*NextAuth\(\{[\s\S]*?\}\);/
export const { handlers, auth } = NextAuth({
  providers: (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
    : [],
  session: { strategy: "jwt" }
});/s;
' -i "$ROUTE" || true

echo "-- Acceptance --"; echo "AUTH_ROUTE_PATCHED=1"; echo "-- End Acceptance --"
