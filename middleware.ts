import { NextResponse, type NextRequest } from "next/server";
export const config = { matcher: ["/chat"] };

export function middleware(req: NextRequest) {
  const ageok = req.cookies.get("ageok")?.value === "1";
  if (req.nextUrl.pathname.startsWith("/chat") && !ageok) {
    const url = new URL("/", req.url);
    url.searchParams.set("age", "required");
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}
