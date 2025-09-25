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
    async jwt({ token, user }: any) {
      if (token.vip === undefined) token.vip = false;
      if (token.vipExp === undefined) token.vipExp = 0;
      if (user?.email && token.email === undefined) token.email = user.email;
      // Legacy support
      if (typeof token.isVip === "undefined") token.isVip = false;
      return token;
    },
    async session({ session, token }: any) {
      (session as any).vip = Boolean(token.vip);
      (session as any).vipExp = Number(token.vipExp || 0);
      // Legacy support
      session.isVip = token.isVip || token.vip || false;
      // تفضيل الكوكي للعرض فقط
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
