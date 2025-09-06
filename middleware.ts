import { NextResponse, type NextRequest } from "next/server";

export const config = { matcher: ["/chat"] };

export function middleware(req: NextRequest) {
  const ageok = req.cookies.get("ageok")?.value === "1";
  if (!ageok) {
    const url = new URL("/", req.url);
    url.searchParams.set("age", "required");
    return NextResponse.redirect(url, 307);
  }
  const res = NextResponse.next();
  // السماح بالكاميرا/المايك داخل النطاق
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self)");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
