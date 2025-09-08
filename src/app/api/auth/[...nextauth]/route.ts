import NextAuth, { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { checkRateLimit, getRateLimitKey } from "@/utils/ratelimit";

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token }) {
      // مرّر isVip من مصدرك (DB/Redis) لاحقًا؛ افتراضيًا false
      if (typeof token.isVip === "undefined") token.isVip = false as any;
      return token;
    },
    async session({ session, token }) {
      (session as any).isVip = (token as any).isVip || false;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

// Rate-limited handlers  
export async function GET(req: Request) {
  const rateLimitKey = getRateLimitKey(req, 'auth');
  if (!checkRateLimit(rateLimitKey, 30, 30)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { 
      status: 429, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return handler(req);
}

export async function POST(req: Request) {
  const rateLimitKey = getRateLimitKey(req, 'auth');
  if (!checkRateLimit(rateLimitKey, 30, 30)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { 
      status: 429, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return handler(req);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
