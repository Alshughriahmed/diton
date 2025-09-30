# DitonaChat — Release Readiness

## Features (pp2/pp3)
- safeFetch موحّد، dc-open مبكّر، AUTO_NEXT عند disconnected/failed.
- رسائل: reset + auto-scroll.
- Gating: Prev/Filters/Beauty = FFA أو (dc.open && pairId).
- meta:init pulses: 0ms, 300ms, 1200ms.
- S9: /api/* dynamic|revalidate=0 أو no-store. middleware لا يعترض /api/*.
- Fast-path: /api/message/allow (FFA).
- Health: /api/_status.

## Local QA
- `pnpm -s build` يجب أن يكون OK.
- شغّل: `bash scripts/qa_local.sh` ⇒ FEATURES_OK=1.

## Env (Staging المقترح)
- FREE_FOR_ALL=1
- NEXT_PUBLIC_FREE_FOR_ALL=1
- NEXTAUTH_URL, NEXTAUTH_SECRET
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- STRIPE_SECRET_KEY (لاحقًا إن لزم)
- TURN_URL, TURN_USER, TURN_CREDENTIAL (إن لزم)

## Smoke بعد النشر
- GET /api/_status ⇒ يحمل service وbuildId.
- GET /api/rtc/env ⇒ no-store وFFA صحيحة.
- GET /api/message/allow ⇒ ok:true عند FFA.
- /chat: قطع اتصال ⇒ AUTO_NEXT + تصفير الرسائل + gating صحيح + like counters.
