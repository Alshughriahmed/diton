export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

// Ensure no-store on every response
function __noStore<T extends Response>(res: T): T {
  try { (res as any)?.headers?.set?.("Cache-Control", "no-store"); } catch {}
  return res;
}

export async function GET() {
  // Server-only flags
  const server = {
    FREE_FOR_ALL: process.env.FREE_FOR_ALL ?? "0",
  };

  // TURN config (exposed intentionally for WebRTC ICE servers)
  // If any piece is missing, return null to signal STUN-only fallback.
  const turnUrl = process.env.TURN_URL ?? process.env.NEXT_PUBLIC_TURN_URL ?? "";
  const turnUser = process.env.TURN_USERNAME ?? "";
  const turnPass = process.env.TURN_PASSWORD ?? "";
  const turnTtl  = Number(process.env.TURN_TTL ?? 300);

  const turn = (turnUrl && turnUser && turnPass)
    ? { url: turnUrl, username: turnUser, password: turnPass, ttl: turnTtl }
    : null;

  const pub = {
    NEXT_PUBLIC_FREE_FOR_ALL: process.env.NEXT_PUBLIC_FREE_FOR_ALL ?? "0",
  };

  return __noStore(
    NextResponse.json(
      { server, public: pub, turn },
      { headers: { "Cache-Control": "no-store" } }
    )
  );
}
