import { NextResponse, type NextRequest } from "next/server";
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)",] };

export function middleware(req: NextRequest) {
  const ageok = req.cookies.get("ageok")?.value === "1";
  if (req.nextUrl.pathname.startsWith("/chat") && !ageok) {
    const url = new URL("/", req.url);
    url.searchParams.set("age", "required");
    return NextResponse.redirect(url, 307);
  }
  const res = NextResponse.next();

  // Override Permissions-Policy بالقيمة الصحيحة
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self)");
  
  // أمن أساسي
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");

  // CSP متساهلة للتطوير
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: data:",
    "frame-ancestors 'none'"
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

  return res;
}
