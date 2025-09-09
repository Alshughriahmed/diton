import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { checkRateLimit, getRateLimitKey } from "@/utils/ratelimit";

export const authOptions = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" as const },
  callbacks: {
    async jwt({ token }: any) {
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

export { handler as GET, handler as POST };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
