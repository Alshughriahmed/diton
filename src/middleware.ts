import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  let response: NextResponse;
  
  // Age Gate: Protect /chat route
  if (req.nextUrl.pathname.startsWith("/chat")) {
    const ok = req.cookies.get("ageok")?.value === "1";
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("age", "required");
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }
  
  // Security Headers: Apply to all responses
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self' blob: data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https: wss:; frame-ancestors 'none'; upgrade-insecure-requests"
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  return response;
}

export const config = {
  matcher: [
    // Age gate matcher
    "/chat",
    // Security headers matcher (all routes except static assets)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};