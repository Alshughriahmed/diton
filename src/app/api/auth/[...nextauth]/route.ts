import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { checkRateLimit, getRateLimitKey } from "@/utils/ratelimit";

// Export authOptions for use in other parts of the app
export const authOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),
  ],
  session: { strategy: "jwt" as const },
  callbacks: {
    async jwt({ token }: any) {
      // مرّر isVip من مصدرك (DB/Redis) لاحقًا؛ افتراضيًا false
      if (typeof token.isVip === "undefined") token.isVip = false;
      return token;
    },
    async session({ session, token }: any) {
      session.isVip = token.isVip || false;
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
  return handler.GET(req);
}

export async function POST(req: Request) {
  const rateLimitKey = getRateLimitKey(req, 'auth');
  if (!checkRateLimit(rateLimitKey, 30, 30)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { 
      status: 429, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return handler.POST(req);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
