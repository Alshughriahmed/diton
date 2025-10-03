import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // Age gate: protect /chat
  if (req.nextUrl.pathname.startsWith("/chat")) {
    const ageok = req.cookies.get("ageok")?.value === "1";
    if (!ageok) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("age", "required");
      const r = NextResponse.redirect(url);
      applySecurityHeaders(r);
      return r;
    }
  }

  const res = NextResponse.next();
  applySecurityHeaders(res);
  return res;
}

function applySecurityHeaders(res: NextResponse) {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
