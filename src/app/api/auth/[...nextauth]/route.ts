import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { checkRateLimit, getRateLimitKey } from "@/utils/ratelimit";

export const { handlers, auth } = NextAuth({
  providers: (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
    : [],
  session: { strategy: "jwt" }
});

// Rate-limited handlers
export async function GET(req: Request) {
  const rateLimitKey = getRateLimitKey(req, 'auth');
  if (!checkRateLimit(rateLimitKey, 30, 30)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { 
      status: 429, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return handlers.GET(req);
}

export async function POST(req: Request) {
  const rateLimitKey = getRateLimitKey(req, 'auth');
  if (!checkRateLimit(rateLimitKey, 30, 30)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { 
      status: 429, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return handlers.POST(req);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";