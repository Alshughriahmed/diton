import { allow, ipFrom } from "../../../lib/ratelimit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const ip = ipFrom(req);
  const rl = allow(`${ip}:age-allow`, 12, 60_000);
  if (!rl.ok) return new Response(JSON.stringify({ ok:false, rate_limited:true, reset: rl.reset }), { status: 429, headers: { "content-type": "application/json" }});

  const res = NextResponse.json({ ok: true, ts: Date.now() });
  res.cookies.set({
    name: "ageok",
    value: "1",
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // سنة
  });
  return res;
}
