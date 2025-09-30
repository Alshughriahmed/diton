# DitonaChat — Smoke Matrix

## Endpoints under test
- GET /api/rtc/env
- GET /api/rtc/qlen
- GET /api/user/vip-status
- POST /api/like  (idempotency: x-idempotency header)

## How to run locally
1) Build once: `pnpm -s build`
2) Start: `PORT=3000 pnpm -s start`
3) In another shell, run: `_ops/scripts/smoke.sh`
Reports saved in `_ops/reports/`.
